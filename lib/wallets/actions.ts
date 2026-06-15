"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { resolveBankAccount } from "@/lib/paystack/banks";
import { createTransferRecipient } from "@/lib/paystack/plans";
import { requireAuth } from "@/lib/auth/get-auth-context";
import {
  encryptAccountNumber,
  maskAccountLast4,
} from "@/lib/wallets/encryption";
import { PAYOUT_FEE_KOBO } from "@/lib/wallets/constants";
import {
  addPayoutAccountSchema,
  ngnToKobo,
  requestWithdrawalSchema,
  validateWithdrawalAmountKobo,
} from "@/lib/wallets/schemas";
import { getCreatorWallet } from "@/lib/wallets/queries";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function revalidateWalletPaths() {
  revalidatePath("/creator/dashboard");
  revalidatePath("/creator/earnings");
  revalidatePath("/creator/withdrawals");
}

export async function addPayoutAccount(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addPayoutAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid bank details",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  let resolvedName = parsed.data.account_name;
  try {
    const resolved = await resolveBankAccount({
      accountNumber: parsed.data.account_number,
      bankCode: parsed.data.bank_code,
    });
    resolvedName = resolved.account_name;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not verify bank account.";
    return { success: false, error: message };
  }

  const encrypted = encryptAccountNumber(parsed.data.account_number);
  const last4 = maskAccountLast4(parsed.data.account_number);

  if (parsed.data.set_default) {
    await supabase
      .from("payout_accounts")
      .update({ is_default: false })
      .eq("creator_id", auth.userId);
  }

  const { data, error } = await supabase
    .from("payout_accounts")
    .insert({
      creator_id: auth.userId,
      type: "bank_account",
      bank_code: parsed.data.bank_code,
      bank_name: parsed.data.bank_name,
      account_number_encrypted: encrypted,
      account_number_last4: last4,
      account_name: resolvedName,
      is_verified: true,
      is_default: parsed.data.set_default,
      verified_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // Create Paystack transfer recipient so payouts can be initiated immediately.
  // Non-fatal: if this fails the account is still saved; admin can re-trigger.
  try {
    const recipientCode = await createTransferRecipient({
      name: resolvedName,
      accountNumber: parsed.data.account_number,
      bankCode: parsed.data.bank_code,
    });
    await supabase
      .from("payout_accounts")
      .update({ paystack_recipient_code: recipientCode })
      .eq("id", data.id);
  } catch (err) {
    logger.warn("paystack.recipient_create_failed", { err, accountId: data.id });
  }

  revalidateWalletPaths();
  return { success: true, data: { id: data.id } };
}

export async function setDefaultPayoutAccount(
  accountId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  await supabase
    .from("payout_accounts")
    .update({ is_default: false })
    .eq("creator_id", auth.userId);

  const { error } = await supabase
    .from("payout_accounts")
    .update({ is_default: true })
    .eq("id", accountId)
    .eq("creator_id", auth.userId);

  if (error) return { success: false, error: error.message };

  revalidateWalletPaths();
  return { success: true };
}

export async function requestWithdrawal(
  input: unknown,
): Promise<ActionResult<{ requestId: string }>> {
  const parsed = requestWithdrawalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid withdrawal",
    };
  }

  const amountKobo = ngnToKobo(parsed.data.amount_ngn);
  const minError = validateWithdrawalAmountKobo(amountKobo);
  if (minError) return { success: false, error: minError };

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  const { data: kycRow } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", auth.userId)
    .single();

  if (kycRow?.kyc_status !== "verified") {
    return {
      success: false,
      error:
        "Identity verification required before withdrawing. Please complete KYC in your profile settings.",
    };
  }

  const { data: cpRow } = await supabase
    .from("creator_profiles")
    .select("first_subscriber_paid_at")
    .eq("user_id", auth.userId)
    .single();

  if (cpRow?.first_subscriber_paid_at) {
    const holdUntil = new Date(
      new Date(cpRow.first_subscriber_paid_at).getTime() +
        14 * 24 * 60 * 60 * 1000,
    );
    if (holdUntil > new Date()) {
      const daysLeft = Math.ceil(
        (holdUntil.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );
      try {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const admin = createAdminClient();
        await writeAuditLog(admin, {
          actorId: auth.userId,
          actorType: "user",
          action: "creator.payout_held",
          entityType: "creator_profiles",
          entityId: auth.userId,
          metadata: {
            hold_until: holdUntil.toISOString(),
            days_remaining: daysLeft,
          },
        });
      } catch {
        // best-effort
      }
      return {
        success: false,
        error: `Your first withdrawal is on hold for ${daysLeft} more day${daysLeft === 1 ? "" : "s"} while we verify your account. This is a one-time security measure.`,
      };
    }
  }

  const wallet = await getCreatorWallet(supabase, auth.userId);
  if (!wallet) {
    return { success: false, error: "Wallet not found." };
  }

  if (wallet.available_kobo < amountKobo) {
    return { success: false, error: "Insufficient available balance." };
  }

  const { data: requestId, error } = await supabase.rpc(
    "create_creator_payout_request",
    {
      p_creator_id: auth.userId,
      p_amount_kobo: amountKobo,
      p_payout_account_id: parsed.data.payout_account_id,
      p_fee_kobo: PAYOUT_FEE_KOBO,
    },
  );

  if (error) {
    return { success: false, error: error.message };
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await writeAuditLog(admin, {
      actorId: auth.userId,
      actorType: "user",
      action: "wallet.payout_requested",
      entityType: "payout_requests",
      entityId: requestId as string,
      afterState: {
        amount_kobo: amountKobo,
        payout_account_id: parsed.data.payout_account_id,
      },
    });
    const { notifyNewPayout } = await import("@/lib/notifications/emit");
    await notifyNewPayout(admin, {
      creatorId: auth.userId,
      payoutRequestId: requestId as string,
      amountKobo,
    });

    const { routePayoutRequest } = await import("@/lib/wallets/payout-processor");
    await routePayoutRequest(admin, { requestId: requestId as string });
  } catch {
    // Best-effort audit when service role is unavailable locally.
  }

  revalidateWalletPaths();
  return { success: true, data: { requestId: requestId as string } };
}
