import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import {
  EARNINGS_CLEARANCE_DAYS,
  PAYMENT_FEE_BPS,
  PLATFORM_FEE_BPS,
} from "@/lib/wallets/constants";

export async function creditCreatorFromPayment(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    paymentId: string;
    grossKobo: number;
    idempotencyKey: string;
    txType?:
      | "subscription_credit"
      | "ppv_credit"
      | "tip_credit"
      | "message_ppv_credit";
    description?: string;
  },
): Promise<string | null> {
  const { data, error } = await admin.rpc("credit_creator_from_payment", {
    p_creator_id: input.creatorId,
    p_payment_id: input.paymentId,
    p_gross_kobo: input.grossKobo,
    p_idempotency_key: input.idempotencyKey,
    p_tx_type: input.txType ?? "subscription_credit",
    p_platform_fee_bps: PLATFORM_FEE_BPS,
    p_payment_fee_bps: PAYMENT_FEE_BPS,
    p_clearance_days: EARNINGS_CLEARANCE_DAYS,
    p_description: input.description ?? null,
  });

  if (error) {
    logger.error("wallet.credit_failed", { err: error, paymentId: input.paymentId, creatorId: input.creatorId });
    throw new Error(error.message);
  }

  await writeAuditLog(admin, {
    actorId: input.creatorId,
    actorType: "system",
    action: "wallet.credited",
    entityType: "wallets",
    entityId: input.creatorId,
    metadata: {
      payment_id: input.paymentId,
      gross_kobo: input.grossKobo,
      wallet_tx_id: data,
    },
  });

  if ((input.txType ?? "subscription_credit") === "subscription_credit") {
    try {
      await stampFirstSubscriberPaidAndCheckVelocity(admin, input.creatorId);
    } catch (err) {
      logger.warn("creator.velocity_check_failed", { err, creatorId: input.creatorId });
    }
  }

  return data as string | null;
}

async function stampFirstSubscriberPaidAndCheckVelocity(
  admin: SupabaseClient,
  creatorId: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Stamp only if not yet set (idempotent first-payment detection).
  await admin
    .from("creator_profiles")
    .update({ first_subscriber_paid_at: now })
    .eq("user_id", creatorId)
    .is("first_subscriber_paid_at", null);

  const { data: cp } = await admin
    .from("creator_profiles")
    .select("first_subscriber_paid_at")
    .eq("user_id", creatorId)
    .single();

  if (!cp?.first_subscriber_paid_at) return;

  const windowStart = new Date(cp.first_subscriber_paid_at);
  const windowEnd = new Date(windowStart.getTime() + 72 * 60 * 60 * 1000);
  if (new Date() > windowEnd) return;

  const { data: payments } = await admin
    .from("payments")
    .select("amount_kobo")
    .eq("creator_id", creatorId)
    .eq("status", "success")
    .gte("created_at", windowStart.toISOString())
    .lte("created_at", windowEnd.toISOString());

  const totalKobo = (payments ?? []).reduce(
    (sum: number, p: { amount_kobo: number }) => sum + (p.amount_kobo ?? 0),
    0,
  );

  const VELOCITY_THRESHOLD_KOBO = 10_000_000; // ₦100k
  if (totalKobo < VELOCITY_THRESHOLD_KOBO) return;

  await admin
    .from("moderation_queue")
    .upsert(
      {
        entity_type: "creator",
        entity_id: creatorId,
        priority_score: 300,
        flags: {
          velocity_alert: true,
          amount_kobo: totalKobo,
          window_hours: 72,
          first_paid_at: cp.first_subscriber_paid_at,
        },
      },
      { onConflict: "entity_type,entity_id", ignoreDuplicates: false },
    );

  await writeAuditLog(admin, {
    actorId: creatorId,
    actorType: "system",
    action: "creator.velocity_flagged",
    entityType: "creator_profiles",
    entityId: creatorId,
    metadata: { amount_kobo: totalKobo, window_hours: 72 },
  });
}

export async function runWalletClearances(
  admin: SupabaseClient,
): Promise<number> {
  const { data, error } = await admin.rpc("run_wallet_clearances");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function reverseCreatorPaymentCredit(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    paymentId: string;
    idempotencyKey: string;
  },
): Promise<boolean> {
  const { data, error } = await admin.rpc("reverse_creator_payment_credit", {
    p_creator_id: input.creatorId,
    p_payment_id: input.paymentId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    logger.error("wallet.refund_reversal_failed", { err: error, paymentId: input.paymentId, creatorId: input.creatorId });
    return false;
  }

  return Boolean(data);
}

export async function holdCreatorPaymentForDispute(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    paymentId: string;
    disputeId: string;
    idempotencyKey: string;
  },
): Promise<boolean> {
  const { data, error } = await admin.rpc("hold_creator_payment_for_dispute", {
    p_creator_id: input.creatorId,
    p_payment_id: input.paymentId,
    p_dispute_id: input.disputeId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    logger.error("wallet.dispute_hold_failed", { err: error, disputeId: input.disputeId, creatorId: input.creatorId });
    return false;
  }

  return Boolean(data);
}

export async function releaseDisputeHold(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    disputeId: string;
    idempotencyKey: string;
  },
): Promise<boolean> {
  const { data, error } = await admin.rpc("release_dispute_hold", {
    p_creator_id: input.creatorId,
    p_dispute_id: input.disputeId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    logger.error("wallet.dispute_release_failed", { err: error, disputeId: input.disputeId, creatorId: input.creatorId });
    return false;
  }

  return Boolean(data);
}

export async function finalizeDisputeLoss(
  admin: SupabaseClient,
  input: {
    creatorId: string;
    disputeId: string;
    idempotencyKey: string;
  },
): Promise<boolean> {
  const { data, error } = await admin.rpc("finalize_dispute_loss", {
    p_creator_id: input.creatorId,
    p_dispute_id: input.disputeId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    logger.error("wallet.dispute_finalize_failed", { err: error, disputeId: input.disputeId, creatorId: input.creatorId });
    return false;
  }

  return Boolean(data);
}
