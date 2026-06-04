import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import {
  asString,
  parseNestedSubscriptionCode,
  parseSubscriptionCheckoutMetadata,
  parseSubscriptionCreatePayload,
} from "@/lib/paystack/parse";
import type { PaystackWebhookBody } from "@/lib/paystack/types";
import { fulfillPpvPurchase } from "@/lib/payments/ppv-processor";
import {
  failSubscriptionPayment,
  fulfillSubscriptionPayment,
  recordSubscriptionRenewal,
} from "@/lib/payments/processor";
import { processRefundWebhook } from "@/lib/payments/refunds";
import { logSubscriptionEvent } from "@/lib/subscriptions/events";
import type { PlanBillingInterval } from "@/types/subscription";

export async function dispatchPaystackWebhook(
  admin: SupabaseClient,
  body: PaystackWebhookBody,
  requestId?: string | null,
): Promise<void> {
  const { event, data } = body;

  switch (event) {
    case "charge.success":
      await handleChargeSuccess(admin, data, requestId);
      return;

    case "charge.failed":
      await handleChargeFailed(admin, data, requestId);
      return;

    case "refund.pending":
    case "refund.processed":
    case "refund.failed":
      await processRefundWebhook(admin, { event, data, requestId });
      return;

    case "subscription.create":
      await handleSubscriptionCreate(admin, data, requestId);
      return;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(admin, data, requestId);
      return;

    case "subscription.disable":
    case "subscription.not_renew":
      await handleSubscriptionDisabled(admin, data, requestId);
      return;

    default:
      return;
  }
}

async function handleChargeSuccess(
  admin: SupabaseClient,
  data: Record<string, unknown>,
  requestId?: string | null,
): Promise<void> {
  const checkoutMeta = parseSubscriptionCheckoutMetadata(data);
  const subCode = parseNestedSubscriptionCode(data);

  if (subCode && !checkoutMeta) {
    await handleRecurringChargeSuccess(admin, data, requestId);
    return;
  }

  const ppvHandled = await fulfillPpvPurchase(admin, {
    chargeData: data,
    requestId,
  });
  if (ppvHandled) return;

  if (!checkoutMeta) return;

  await fulfillSubscriptionPayment(admin, {
    chargeData: data,
    requestId,
    source: "webhook",
  });
}

async function handleRecurringChargeSuccess(
  admin: SupabaseClient,
  data: Record<string, unknown>,
  requestId?: string | null,
): Promise<void> {
  const subCode = parseNestedSubscriptionCode(data);
  const reference = asString(data.reference);
  const amount = typeof data.amount === "number" ? data.amount : 0;

  if (!subCode || !reference) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, fan_id, creator_id, billing_interval, status")
    .eq("paystack_subscription_code", subCode)
    .maybeSingle();

  if (!sub) return;

  await recordSubscriptionRenewal(admin, {
    subscriptionId: sub.id,
    fanId: sub.fan_id,
    creatorId: sub.creator_id,
    amountKobo: amount,
    paystackReference: reference,
    paystackTransactionId: String(data.id ?? ""),
    billingInterval: sub.billing_interval as PlanBillingInterval,
    requestId,
  });
}

async function handleChargeFailed(
  admin: SupabaseClient,
  data: Record<string, unknown>,
  requestId?: string | null,
): Promise<void> {
  const meta = parseSubscriptionCheckoutMetadata(data);
  const reference = asString(data.reference);
  if (!reference) return;

  if (meta || reference.startsWith("fb_sub_")) {
    const reason =
      asString(data.gateway_response) ??
      asString(data.message) ??
      "Charge failed";
    await failSubscriptionPayment(admin, {
      reference,
      reason,
      requestId,
      chargeData: data,
    });
  }
}

async function handleSubscriptionCreate(
  admin: SupabaseClient,
  data: Record<string, unknown>,
  requestId?: string | null,
): Promise<void> {
  const code = parseNestedSubscriptionCode(data);
  if (!code) return;

  const { planCode, customerEmail } = parseSubscriptionCreatePayload(data);

  // Both fields are required for a deterministic match. Without them we
  // cannot safely identify which subscription to update, so we bail out and
  // log rather than risk cross-wiring a different user's subscription.
  if (!planCode || !customerEmail) {
    await writeAuditLog(admin, {
      actorType: "paystack",
      action: "subscription.create_skipped",
      entityType: "paystack_webhook",
      requestId,
      metadata: {
        subscription_code: code,
        reason: "missing_plan_code_or_email",
      },
    });
    return;
  }

  // Resolve the internal plan by its Paystack plan code.
  const { data: planRow } = await admin
    .from("subscription_plans")
    .select("id")
    .eq("paystack_plan_code", planCode)
    .maybeSingle();

  if (!planRow) return;

  // Resolve the fan by email. listUsers is limited to 200 per page; this is
  // acceptable for current scale. A DB-level email index can replace this
  // once auth.users grows beyond that.
  const { data: userList } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const user = userList?.users?.find(
    (u) => u.email?.toLowerCase() === customerEmail.toLowerCase(),
  );
  if (!user) return;

  // Match by fan + plan — the only combination that uniquely identifies the
  // subscription without relying on timing or null-code availability.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, fan_id, paystack_subscription_code")
    .eq("fan_id", user.id)
    .eq("plan_id", planRow.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return;

  // Idempotent: charge.success may have already stored the code via
  // createPaystackSubscription. If so, nothing to do.
  if (sub.paystack_subscription_code === code) return;

  await admin
    .from("subscriptions")
    .update({ paystack_subscription_code: code })
    .eq("id", sub.id);

  await writeAuditLog(admin, {
    actorId: sub.fan_id,
    actorType: "paystack",
    action: "subscription.activated",
    entityType: "subscriptions",
    entityId: sub.id,
    requestId,
    metadata: { paystack_subscription_code: code },
  });
}

async function handleInvoicePaymentFailed(
  admin: SupabaseClient,
  data: Record<string, unknown>,
  requestId?: string | null,
): Promise<void> {
  const subCode = parseNestedSubscriptionCode(data);
  if (!subCode) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, fan_id")
    .eq("paystack_subscription_code", subCode)
    .maybeSingle();

  if (!sub) return;

  await admin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("id", sub.id);

  await logSubscriptionEvent(admin, sub.id, "past_due", {
    source: "invoice.payment_failed",
  });

  await writeAuditLog(admin, {
    actorId: sub.fan_id,
    actorType: "paystack",
    action: "subscription.past_due",
    entityType: "subscriptions",
    entityId: sub.id,
    requestId,
    metadata: { paystack_subscription_code: subCode },
  });
}

async function handleSubscriptionDisabled(
  admin: SupabaseClient,
  data: Record<string, unknown>,
  requestId?: string | null,
): Promise<void> {
  const subCode = parseNestedSubscriptionCode(data);
  if (!subCode) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, fan_id")
    .eq("paystack_subscription_code", subCode)
    .maybeSingle();

  if (!sub) return;

  await admin
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  await logSubscriptionEvent(admin, sub.id, "cancel_scheduled", {
    source: "paystack_subscription_disabled",
  });

  await writeAuditLog(admin, {
    actorId: sub.fan_id,
    actorType: "paystack",
    action: "subscription.cancel_scheduled",
    entityType: "subscriptions",
    entityId: sub.id,
    requestId,
    metadata: { paystack_subscription_code: subCode },
  });
}
