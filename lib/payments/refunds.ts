import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { asNumber, asRecord, asString } from "@/lib/paystack/parse";
import { logSubscriptionEvent } from "@/lib/subscriptions/events";
import { reverseCreatorPaymentCredit } from "@/lib/wallets/ledger";

export async function processRefundWebhook(
  admin: SupabaseClient,
  input: {
    event: string;
    data: Record<string, unknown>;
    requestId?: string | null;
  },
): Promise<void> {
  const transaction = asRecord(input.data.transaction);
  const reference =
    asString(transaction?.reference) ?? asString(input.data.transaction_reference);
  const refundId = asString(input.data.id) ?? asString(input.data.refund_reference);
  const amount = asNumber(input.data.amount) ?? asNumber(transaction?.amount);

  if (!reference || !refundId) return;

  const { data: payment } = await admin
    .from("payments")
    .select("id, payer_id, subscription_id, status, amount_kobo, creator_id")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (!payment) return;

  const refundStatus =
    input.event === "refund.processed"
      ? "processed"
      : input.event === "refund.failed"
        ? "failed"
        : "pending";

  const { error: refundUpsertError } = await admin.from("payment_refunds").upsert(
    {
      payment_id: payment.id,
      paystack_refund_id: refundId,
      amount_kobo: amount ?? payment.amount_kobo,
      status: refundStatus,
      reason: asString(input.data.reason) ?? null,
      metadata: { event: input.event, raw: input.data },
      processed_at:
        refundStatus === "processed" ? new Date().toISOString() : null,
    },
    { onConflict: "paystack_refund_id" },
  );

  if (refundUpsertError) {
    console.error("[payment_refunds]", refundUpsertError.message);
  }

  if (refundStatus === "failed") {
    await writeAuditLog(admin, {
      actorId: payment.payer_id,
      actorType: "paystack",
      action: "payment.refund_failed",
      entityType: "payments",
      entityId: payment.id,
      requestId: input.requestId,
      metadata: { paystack_refund_id: refundId, reference },
    });
    return;
  }

  if (refundStatus !== "processed") return;

  if (payment.status !== "refunded") {
    await admin
      .from("payments")
      .update({
        status: "refunded",
        webhook_processed_at: new Date().toISOString(),
        metadata: {
          refunded_at: new Date().toISOString(),
          paystack_refund_id: refundId,
        },
      })
      .eq("id", payment.id);
  }

  if (payment.subscription_id) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, fan_id, status")
      .eq("id", payment.subscription_id)
      .maybeSingle();

    if (sub && sub.status !== "cancelled" && sub.status !== "expired") {
      await admin
        .from("subscriptions")
        .update({
          status: "cancelled",
          ended_at: new Date().toISOString(),
          cancel_at_period_end: false,
        })
        .eq("id", sub.id);

      await logSubscriptionEvent(admin, sub.id, "revoked_refund", {
        payment_id: payment.id,
        paystack_refund_id: refundId,
      });

      await writeAuditLog(admin, {
        actorId: sub.fan_id,
        actorType: "paystack",
        action: "subscription.revoked_refund",
        entityType: "subscriptions",
        entityId: sub.id,
        requestId: input.requestId,
        metadata: { payment_id: payment.id, paystack_refund_id: refundId },
      });
    }
  }

  if (payment.creator_id) {
    const reversed = await reverseCreatorPaymentCredit(admin, {
      creatorId: payment.creator_id,
      paymentId: payment.id,
      idempotencyKey: `refund:${refundId}:reverse`,
    });
    if (reversed) {
      await writeAuditLog(admin, {
        actorId: payment.creator_id,
        actorType: "paystack",
        action: "wallet.reversed_refund",
        entityType: "wallets",
        entityId: payment.creator_id,
        requestId: input.requestId,
        metadata: { payment_id: payment.id, paystack_refund_id: refundId },
      });
    }
  }

  await writeAuditLog(admin, {
    actorId: payment.payer_id,
    actorType: "paystack",
    action: "payment.refunded",
    entityType: "payments",
    entityId: payment.id,
    requestId: input.requestId,
    afterState: {
      paystack_refund_id: refundId,
      amount_kobo: amount ?? payment.amount_kobo,
    },
  });
}
