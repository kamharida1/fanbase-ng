import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { initiatePaystackTransfer } from "@/lib/paystack/transfers";
import { createTransferRecipient } from "@/lib/paystack/plans";
import {
  assessPayoutRisk,
  formatPayoutReviewReasons,
  loadPayoutContext,
} from "@/lib/wallets/payout-automation/risk";
import { decryptAccountNumber } from "@/lib/wallets/encryption";

export type ProcessPayoutResult =
  | { ok: true; status: "processing" | "review" }
  | { ok: false; error: string };

type PayoutRequestRow = {
  id: string;
  creator_id: string;
  wallet_id: string;
  payout_account_id: string;
  net_amount_kobo: number;
  amount_kobo: number;
  status: string;
};

export async function routePayoutRequest(
  admin: SupabaseClient,
  input: { requestId: string; adminUserId?: string | null },
): Promise<ProcessPayoutResult> {
  const request = await getPayoutRequest(admin, input.requestId);
  if (!request) return { ok: false, error: "Payout request not found." };
  if (!["pending", "review"].includes(request.status)) {
    return { ok: false, error: `Payout cannot be processed in status ${request.status}.` };
  }

  const ctx = await loadPayoutContext(admin, {
    creatorId: request.creator_id,
    netAmountKobo: request.net_amount_kobo,
    payoutAccountId: request.payout_account_id,
  });
  const risk = assessPayoutRisk(ctx);

  if (risk.autoApprovable) {
    return processPayoutTransfer(admin, {
      requestId: request.id,
      adminUserId: input.adminUserId ?? null,
      source: input.adminUserId ? "admin" : "auto",
    });
  }

  if (request.status === "pending") {
    const { error } = await admin
      .from("payout_requests")
      .update({
        status: "review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) return { ok: false, error: error.message };

    try {
      const { notifyPayoutReviewQueued } = await import("@/lib/notifications/emit");
      await notifyPayoutReviewQueued(admin, {
        creatorId: request.creator_id,
        payoutRequestId: request.id,
        amountKobo: request.amount_kobo,
        reason: formatPayoutReviewReasons(risk.reasons),
      });
    } catch (err) {
      logger.warn("notifications.payout_review_queued_failed", { err, requestId: request.id });
    }
  }

  return { ok: true, status: "review" };
}

export async function processPayoutTransfer(
  admin: SupabaseClient,
  input: {
    requestId: string;
    adminUserId?: string | null;
    source: "admin" | "auto";
  },
): Promise<ProcessPayoutResult> {
  const request = await getPayoutRequest(admin, input.requestId);
  if (!request) return { ok: false, error: "Payout request not found." };
  if (!["pending", "review"].includes(request.status)) {
    return { ok: false, error: `Payout cannot be processed in status ${request.status}.` };
  }

  const { data: account, error: accountError } = await admin
    .from("payout_accounts")
    .select(
      "id, bank_code, bank_name, account_name, account_number_encrypted, paystack_recipient_code",
    )
    .eq("id", request.payout_account_id)
    .maybeSingle();

  if (accountError || !account) {
    return { ok: false, error: "Payout bank account not found." };
  }

  let recipientCode = account.paystack_recipient_code;
  if (!recipientCode) {
    try {
      const accountNumber = decryptAccountNumber(account.account_number_encrypted);
      recipientCode = await createTransferRecipient({
        name: account.account_name,
        accountNumber,
        bankCode: account.bank_code ?? "",
      });
      await admin
        .from("payout_accounts")
        .update({ paystack_recipient_code: recipientCode })
        .eq("id", account.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not prepare Paystack transfer.";
      return { ok: false, error: message };
    }
  }

  const now = new Date().toISOString();
  const { error: markError } = await admin
    .from("payout_requests")
    .update({
      status: "processing",
      reviewed_by: input.adminUserId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", request.id)
    .in("status", ["pending", "review"]);

  if (markError) return { ok: false, error: markError.message };

  try {
    const transfer = await initiatePaystackTransfer({
      recipientCode,
      amountKobo: request.net_amount_kobo,
      reference: `payout_${request.id}`,
    });

    const { error: transferError } = await admin
      .from("payout_requests")
      .update({
        paystack_transfer_code: transfer.transferCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (transferError) {
      logger.error("payout.transfer_code_save_failed", {
        err: transferError,
        requestId: request.id,
      });
    }

    try {
      const { notifyPayoutProcessing } = await import("@/lib/notifications/emit");
      await notifyPayoutProcessing(admin, {
        creatorId: request.creator_id,
        payoutRequestId: request.id,
        amountKobo: request.amount_kobo,
        source: input.source,
      });
    } catch (err) {
      logger.warn("notifications.payout_processing_failed", { err, requestId: request.id });
    }

    return { ok: true, status: "processing" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Paystack transfer failed.";
    await failProcessingPayout(admin, {
      requestId: request.id,
      creatorId: request.creator_id,
      walletId: request.wallet_id,
      refundAmountKobo: request.amount_kobo,
      notifyAmountKobo: request.amount_kobo,
      reason: message,
    });
    return { ok: false, error: message };
  }
}

async function failProcessingPayout(
  admin: SupabaseClient,
  input: {
    requestId: string;
    creatorId: string;
    walletId: string;
    refundAmountKobo: number;
    notifyAmountKobo: number;
    reason: string;
  },
): Promise<void> {
  await admin
    .from("payout_requests")
    .update({
      status: "failed",
      failure_reason: input.reason.slice(0, 500),
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .eq("status", "processing");

  await admin.rpc("credit_wallet_on_payout_failure", {
    p_wallet_id: input.walletId,
    p_amount_kobo: input.refundAmountKobo,
    p_payout_request_id: input.requestId,
  });

  try {
    const { notifyPayoutFailed } = await import("@/lib/notifications/emit");
    await notifyPayoutFailed(admin, {
      creatorId: input.creatorId,
      payoutRequestId: input.requestId,
      amountKobo: input.notifyAmountKobo,
      reason: input.reason,
    });
  } catch (err) {
    logger.warn("notifications.payout_failed_notify_error", { err, requestId: input.requestId });
  }
}

async function getPayoutRequest(
  admin: SupabaseClient,
  requestId: string,
): Promise<PayoutRequestRow | null> {
  const { data } = await admin
    .from("payout_requests")
    .select("id, creator_id, wallet_id, payout_account_id, net_amount_kobo, amount_kobo, status")
    .eq("id", requestId)
    .maybeSingle();
  return data as PayoutRequestRow | null;
}

export async function autoProcessEligiblePayouts(
  admin: SupabaseClient,
  limit = 20,
): Promise<{ processed: number; queuedForReview: number; errors: number }> {
  const { data: requests } = await admin
    .from("payout_requests")
    .select("id")
    .in("status", ["pending", "review"])
    .order("created_at", { ascending: true })
    .limit(limit);

  let processed = 0;
  let queuedForReview = 0;
  let errors = 0;

  for (const row of requests ?? []) {
    const result = await routePayoutRequest(admin, { requestId: row.id });
    if (!result.ok) {
      errors += 1;
      continue;
    }
    if (result.status === "processing") processed += 1;
    if (result.status === "review") queuedForReview += 1;
  }

  return { processed, queuedForReview, errors };
}

export async function notifyStalePayouts(admin: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stale } = await admin
    .from("payout_requests")
    .select("id, creator_id, amount_kobo, status, created_at, reviewed_at")
    .in("status", ["pending", "review", "processing"])
    .limit(50);

  let sent = 0;
  const { notifyPayoutDelayed } = await import("@/lib/notifications/emit");

  for (const row of stale ?? []) {
    const anchor =
      row.status === "processing"
        ? row.reviewed_at ?? row.created_at
        : row.created_at;
    if (anchor >= cutoff) continue;

    await notifyPayoutDelayed(admin, {
      creatorId: row.creator_id,
      payoutRequestId: row.id,
      amountKobo: row.amount_kobo,
      status: row.status,
    });
    sent += 1;
  }

  return sent;
}
