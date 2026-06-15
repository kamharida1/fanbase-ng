import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import {
  asString,
  parseNestedSubscriptionCode,
  parseSubscriptionCheckoutMetadata,
  parseSubscriptionCreatePayload,
} from "@/lib/paystack/parse";
import type { PaystackWebhookBody } from "@/lib/paystack/types";
import { processDisputeWebhook } from "@/lib/payments/disputes";
import { fulfillPpvPurchase } from "@/lib/payments/ppv-processor";
import {
  failSubscriptionPayment,
  fulfillSubscriptionPayment,
  fulfillTipPayment,
  recordSubscriptionRenewal,
} from "@/lib/payments/processor";
import { processRefundWebhook } from "@/lib/payments/refunds";
import { logSubscriptionEvent } from "@/lib/subscriptions/events";
import { pastDueGraceEnds } from "@/lib/subscriptions/period";
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

    case "charge.dispute.create":
    case "charge.dispute.remind":
    case "charge.dispute.resolve":
      await processDisputeWebhook(admin, { event, data, requestId });
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

    case "transfer.success":
      await handleTransferSuccess(admin, data, requestId);
      return;

    case "transfer.failed":
    case "transfer.reversed":
      await handleTransferFailure(admin, data, event, requestId);
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

  const tipHandled = await fulfillTipPayment(admin, {
    chargeData: data,
    requestId,
  });
  if (tipHandled) return;

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
    .select("id, fan_id, creator_id, current_period_end, subscription_plans (name)")
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

  if (sub.current_period_end) {
    const planRaw = sub.subscription_plans as { name: string } | { name: string }[] | null;
    const planName = Array.isArray(planRaw) ? planRaw[0]?.name : planRaw?.name;
    const { notifySubscriptionPastDue } = await import("@/lib/notifications/emit");
    await notifySubscriptionPastDue(admin, {
      fanId: sub.fan_id,
      creatorId: sub.creator_id,
      subscriptionId: sub.id,
      planName: planName ?? "your plan",
      graceEndsAt: pastDueGraceEnds(new Date(sub.current_period_end)),
    }).catch((err) => console.error("[notify:payment_failed]", err));
  }
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

async function handleTransferSuccess(
  admin: SupabaseClient,
  data: Record<string, unknown>,
  requestId?: string | null,
): Promise<void> {
  const transferCode = asString(data.transfer_code);
  if (!transferCode) return;

  const { data: payout, error } = await admin
    .from("payout_requests")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
    })
    .eq("paystack_transfer_code", transferCode)
    .eq("status", "processing") // idempotency: skip if already completed
    .select("id, creator_id, net_amount_kobo, amount_kobo")
    .single();

  if (error || !payout) return;

  await writeAuditLog(admin, {
    actorType: "paystack",
    action: "wallet.payout_completed",
    entityType: "payout_requests",
    entityId: payout.id,
    requestId,
    metadata: { transfer_code: transferCode, net_kobo: payout.net_amount_kobo },
  });

  try {
    const { notifyPayoutProcessed } = await import("@/lib/notifications/emit");
    await notifyPayoutProcessed(admin, {
      creatorId: payout.creator_id,
      payoutRequestId: payout.id,
      amountKobo: payout.amount_kobo,
    });
  } catch (err) {
    logger.warn("notifications.payout_completed_failed", { err, payoutId: payout.id });
  }
}

async function handleTransferFailure(
  admin: SupabaseClient,
  data: Record<string, unknown>,
  event: string,
  requestId?: string | null,
): Promise<void> {
  const transferCode = asString(data.transfer_code);
  if (!transferCode) return;

  const failuresArr = Array.isArray(data.failures) ? data.failures : [];
  const firstFailure = failuresArr[0] as Record<string, unknown> | undefined;
  const failureReason =
    asString(data.gateway_response) ??
    asString(firstFailure?.reason) ??
    event;

  const { data: payout, error } = await admin
    .from("payout_requests")
    .update({
      status: "failed",
      failure_reason: failureReason.slice(0, 500),
      processed_at: new Date().toISOString(),
    })
    .eq("paystack_transfer_code", transferCode)
    .eq("status", "processing") // idempotency guard
    .select("id, creator_id, wallet_id, amount_kobo, net_amount_kobo")
    .single();

  if (error || !payout) return;

  // Credit the net amount back to the creator's available balance so they
  // can request another withdrawal. Done as a separate ledger transaction.
  await admin.rpc("credit_wallet_on_payout_failure", {
    p_wallet_id: payout.wallet_id,
    p_amount_kobo: payout.amount_kobo,
    p_payout_request_id: payout.id,
  });

  await writeAuditLog(admin, {
    actorType: "paystack",
    action: "wallet.payout_failed",
    entityType: "payout_requests",
    entityId: payout.id,
    requestId,
    metadata: {
      transfer_code: transferCode,
      event,
      reason: failureReason,
      net_kobo: payout.net_amount_kobo,
    },
  });

  logger.error("payout.transfer_failed", {
    payoutId: payout.id,
    creatorId: payout.creator_id,
    netKobo: payout.net_amount_kobo,
    transferCode,
    event,
    reason: failureReason,
  });

  try {
    const { notifyPayoutFailed } = await import("@/lib/notifications/emit");
    await notifyPayoutFailed(admin, {
      creatorId: payout.creator_id,
      payoutRequestId: payout.id,
      amountKobo: payout.amount_kobo,
      reason: failureReason,
    });
  } catch (err) {
    logger.warn("notifications.payout_failed_failed", { err, payoutId: payout.id });
  }
}
