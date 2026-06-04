import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
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
    console.error("[wallet credit]", error.message, input.paymentId);
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

  return data as string | null;
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
    console.error("[wallet refund]", error.message);
    return false;
  }

  return Boolean(data);
}
