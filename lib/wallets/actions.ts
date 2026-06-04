"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { resolveBankAccount } from "@/lib/paystack/banks";
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
  } catch {
    // Best-effort audit when service role is unavailable locally.
  }

  revalidateWalletPaths();
  return { success: true, data: { requestId: requestId as string } };
}
