import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { chargeAmountMatchesPayment } from "@/lib/security/payment-amount";
import { creditCreatorFromPayment } from "@/lib/wallets/ledger";

export type PpvPurchaseMetadata = {
  fan_id: string;
  post_id: string;
  creator_id: string;
  purpose: "ppv_purchase";
};

export function parsePpvPurchaseMetadata(
  data: Record<string, unknown>,
): PpvPurchaseMetadata | null {
  const meta = data.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  const fanId = typeof m.fan_id === "string" ? m.fan_id : undefined;
  const postId = typeof m.post_id === "string" ? m.post_id : undefined;
  const creatorId = typeof m.creator_id === "string" ? m.creator_id : undefined;
  const purpose = typeof m.purpose === "string" ? m.purpose : undefined;
  if (purpose !== "ppv_purchase" || !fanId || !postId || !creatorId) return null;
  return { fan_id: fanId, post_id: postId, creator_id: creatorId, purpose };
}

export async function fulfillPpvPurchase(
  admin: SupabaseClient,
  input: {
    chargeData: Record<string, unknown>;
    requestId?: string | null;
  },
): Promise<boolean> {
  const meta = parsePpvPurchaseMetadata(input.chargeData);
  if (!meta) return false;

  const reference =
    typeof input.chargeData.reference === "string"
      ? input.chargeData.reference
      : undefined;
  if (!reference) return false;

  const amount =
    typeof input.chargeData.amount === "number"
      ? input.chargeData.amount
      : 0;

  const { data: payment } = await admin
    .from("payments")
    .select("id, status, amount_kobo, payer_id, post_id, creator_id, type")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (!payment || payment.type !== "ppv") return false;

  if (payment.payer_id !== meta.fan_id) return false;
  if (payment.post_id && payment.post_id !== meta.post_id) return false;
  if (payment.creator_id && payment.creator_id !== meta.creator_id) return false;

  if (!chargeAmountMatchesPayment(amount, payment.amount_kobo)) {
    return false;
  }

  const { data: post } = await admin
    .from("posts")
    .select("ppv_price_kobo, visibility, moderation_status, status")
    .eq("id", meta.post_id)
    .maybeSingle();

  if (
    !post ||
    post.visibility !== "ppv" ||
    post.moderation_status !== "approved" ||
    post.status !== "published" ||
    !post.ppv_price_kobo ||
    post.ppv_price_kobo !== payment.amount_kobo
  ) {
    return false;
  }

  if (payment.status === "success") return true;

  const { data: existing } = await admin
    .from("ppv_purchases")
    .select("id")
    .eq("fan_id", meta.fan_id)
    .eq("post_id", meta.post_id)
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

  const { error: purchaseError } = await admin.from("ppv_purchases").insert({
    fan_id: meta.fan_id,
    post_id: meta.post_id,
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
      txType: "ppv_credit",
      description: "PPV unlock",
    });
  } catch (err) {
    console.error("[wallet] ppv credit", err);
  }

  await writeAuditLog(admin, {
    actorId: meta.fan_id,
    actorType: "user",
    action: "payment.succeeded",
    entityType: "ppv_purchases",
    entityId: meta.post_id,
    requestId: input.requestId,
    metadata: { reference },
  });

  return true;
}
