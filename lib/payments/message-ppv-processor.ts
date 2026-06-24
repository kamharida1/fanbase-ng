import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { chargeAmountMatchesPayment } from "@/lib/security/payment-amount";
import { creditCreatorFromPayment } from "@/lib/wallets/ledger";

export type MessagePpvPurchaseMetadata = {
  fan_id: string;
  message_id: string;
  message_created_at: string;
  creator_id: string;
  purpose: "message_ppv_purchase";
};

export function parseMessagePpvPurchaseMetadata(
  data: Record<string, unknown>,
): MessagePpvPurchaseMetadata | null {
  const meta = data.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  const fanId = typeof m.fan_id === "string" ? m.fan_id : undefined;
  const messageId = typeof m.message_id === "string" ? m.message_id : undefined;
  const messageCreatedAt =
    typeof m.message_created_at === "string" ? m.message_created_at : undefined;
  const creatorId = typeof m.creator_id === "string" ? m.creator_id : undefined;
  const purpose = typeof m.purpose === "string" ? m.purpose : undefined;
  if (
    purpose !== "message_ppv_purchase" ||
    !fanId ||
    !messageId ||
    !messageCreatedAt ||
    !creatorId
  ) {
    return null;
  }
  return {
    fan_id: fanId,
    message_id: messageId,
    message_created_at: messageCreatedAt,
    creator_id: creatorId,
    purpose,
  };
}

export async function fulfillMessagePpvPurchase(
  admin: SupabaseClient,
  input: {
    chargeData: Record<string, unknown>;
    requestId?: string | null;
  },
): Promise<boolean> {
  const meta = parseMessagePpvPurchaseMetadata(input.chargeData);
  if (!meta) return false;

  const reference =
    typeof input.chargeData.reference === "string"
      ? input.chargeData.reference
      : undefined;
  if (!reference) return false;

  const amount =
    typeof input.chargeData.amount === "number" ? input.chargeData.amount : 0;

  const { data: payment } = await admin
    .from("payments")
    .select("id, status, amount_kobo, payer_id, message_id, creator_id, type")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (!payment || payment.type !== "ppv") return false;

  if (payment.payer_id !== meta.fan_id) return false;
  if (payment.message_id && payment.message_id !== meta.message_id) return false;
  if (payment.creator_id && payment.creator_id !== meta.creator_id) return false;

  if (!chargeAmountMatchesPayment(amount, payment.amount_kobo)) {
    return false;
  }

  const { data: message } = await admin
    .from("messages")
    .select("id, is_ppv, ppv_price_kobo, sender_id, created_at")
    .eq("id", meta.message_id)
    .eq("created_at", meta.message_created_at)
    .maybeSingle();

  if (
    !message ||
    !message.is_ppv ||
    !message.ppv_price_kobo ||
    message.ppv_price_kobo !== payment.amount_kobo ||
    message.sender_id !== meta.creator_id
  ) {
    return false;
  }

  if (payment.status === "success") return true;

  const { data: existing } = await admin
    .from("message_purchases")
    .select("id")
    .eq("fan_id", meta.fan_id)
    .eq("message_id", meta.message_id)
    .eq("message_created_at", meta.message_created_at)
    .maybeSingle();

  if (existing) return true;

  const paymentId = payment.id;

  await admin
    .from("payments")
    .update({
      status: "success",
      webhook_processed_at: new Date().toISOString(),
      paystack_transaction_id: String(input.chargeData.id ?? ""),
    })
    .eq("id", paymentId);

  const { error: purchaseError } = await admin.from("message_purchases").insert({
    fan_id: meta.fan_id,
    message_id: meta.message_id,
    message_created_at: meta.message_created_at,
    payment_id: paymentId,
    amount_kobo: amount,
  });

  if (purchaseError && purchaseError.code !== "23505") {
    throw new Error(purchaseError.message);
  }

  try {
    await creditCreatorFromPayment(admin, {
      creatorId: meta.creator_id,
      paymentId,
      grossKobo: amount,
      idempotencyKey: `payment:${paymentId}:credit`,
      txType: "message_ppv_credit",
      description: "Paid message unlock",
    });
  } catch (err) {
    logger.error("wallet.message_ppv_credit_failed", {
      err,
      paymentId,
      creatorId: meta.creator_id,
      grossKobo: amount,
      idempotencyKey: `payment:${paymentId}:credit`,
    });
  }

  await writeAuditLog(admin, {
    actorId: meta.fan_id,
    actorType: "user",
    action: "payment.succeeded",
    entityType: "message_purchases",
    entityId: meta.message_id,
    requestId: input.requestId,
    metadata: { reference },
  });

  return true;
}
