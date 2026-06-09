import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { storeCardFingerprintAndCheck } from "@/lib/payments/card-fingerprint";
import { logger } from "@/lib/logger";
import { parseTipMetadata, parseSubscriptionCheckoutMetadata } from "@/lib/paystack/parse";
import { chargeAmountMatchesPayment } from "@/lib/security/payment-amount";
import { creditCreatorFromPayment } from "@/lib/wallets/ledger";
import { completePaidSubscription } from "@/lib/subscriptions/service";
import { logSubscriptionEvent } from "@/lib/subscriptions/events";
import { renewSubscriptionPeriod } from "@/lib/subscriptions/lifecycle";
import type { PlanBillingInterval } from "@/types/subscription";

export type PaymentRow = {
  id: string;
  payer_id: string;
  paystack_reference: string;
  amount_kobo: number;
  status: string;
  type: string | null;
  subscription_id: string | null;
  post_id: string | null;
  creator_id: string | null;
  metadata: Record<string, unknown>;
};

export async function getPaymentByReference(
  admin: SupabaseClient,
  reference: string,
): Promise<PaymentRow | null> {
  const { data } = await admin
    .from("payments")
    .select(
      "id, payer_id, paystack_reference, amount_kobo, status, type, subscription_id, post_id, creator_id, metadata",
    )
    .eq("paystack_reference", reference)
    .maybeSingle();

  return data as PaymentRow | null;
}

export async function fulfillSubscriptionPayment(
  admin: SupabaseClient,
  input: {
    chargeData: Record<string, unknown>;
    requestId?: string | null;
    source: "webhook" | "verify";
  },
): Promise<{ subscriptionId: string; paymentId: string } | null> {
  const meta = parseSubscriptionCheckoutMetadata(input.chargeData);
  if (!meta) return null;

  const reference =
    typeof input.chargeData.reference === "string"
      ? input.chargeData.reference
      : undefined;
  if (!reference) return null;

  const payment = await getPaymentByReference(admin, reference);
  if (payment?.status === "success" && payment.subscription_id) {
    if (payment.creator_id) {
      try {
        await creditCreatorFromPayment(admin, {
          creatorId: payment.creator_id,
          paymentId: payment.id,
          grossKobo: payment.amount_kobo,
          idempotencyKey: `payment:${payment.id}:credit`,
          description: "Subscription payment",
        });
      } catch {
        // Idempotent — already credited.
      }
    }
    return {
      subscriptionId: payment.subscription_id,
      paymentId: payment.id,
    };
  }

  const amount =
    typeof input.chargeData.amount === "number"
      ? input.chargeData.amount
      : payment?.amount_kobo ?? 0;

  if (
    !payment ||
    payment.payer_id !== meta.fan_id ||
    !chargeAmountMatchesPayment(amount, payment.amount_kobo)
  ) {
    return null;
  }

  const planId = meta.plan_id;
  const { data: plan } = await admin
    .from("subscription_plans")
    .select("id, price_kobo, is_active, creator_id")
    .eq("id", planId)
    .maybeSingle();

  if (
    !plan ||
    !plan.is_active ||
    plan.creator_id !== meta.creator_id ||
    plan.price_kobo !== payment.amount_kobo
  ) {
    return null;
  }

  const customer = input.chargeData.customer as Record<string, unknown> | undefined;
  const authorization = input.chargeData.authorization as
    | Record<string, unknown>
    | undefined;

  const subscriptionId = await completePaidSubscription(admin, {
    fanId: meta.fan_id,
    planId: meta.plan_id,
    paystackReference: reference,
    paystackTransactionId: String(input.chargeData.id ?? ""),
    paystackCustomerCode:
      typeof customer?.customer_code === "string"
        ? customer.customer_code
        : undefined,
    authorizationCode:
      typeof authorization?.authorization_code === "string"
        ? authorization.authorization_code
        : undefined,
    amountKobo: amount,
    bundleMonths: meta.bundle_months,
    giftId: meta.gift_id,
  });

  const { data: updated } = await admin
    .from("payments")
    .select("id")
    .eq("paystack_reference", reference)
    .single();

  await admin
    .from("payments")
    .update({
      verified_at: new Date().toISOString(),
      idempotency_key: reference,
    })
    .eq("paystack_reference", reference);

  await writeAuditLog(admin, {
    actorId: meta.fan_id,
    actorType: "user",
    action: "payment.succeeded",
    entityType: "payments",
    entityId: updated?.id,
    requestId: input.requestId,
    afterState: {
      subscription_id: subscriptionId,
      reference,
      source: input.source,
    },
    metadata: { plan_id: meta.plan_id, creator_id: meta.creator_id },
  });

  await writeAuditLog(admin, {
    actorId: meta.fan_id,
    actorType: "user",
    action: "subscription.activated",
    entityType: "subscriptions",
    entityId: subscriptionId,
    requestId: input.requestId,
    metadata: { plan_id: meta.plan_id, billing_interval: meta.billing_interval },
  });

  // Qualify referral on first subscription payment (fire-and-forget)
  import("@/lib/referrals/actions").then(({ qualifyAndRewardReferral }) =>
    qualifyAndRewardReferral({
      refereeId: meta.fan_id,
      paymentId: updated?.id ?? payment?.id ?? "",
      paymentAmountKobo: amount,
    }),
  ).catch((err) => logger.error("referral.qualify_failed", { err, paymentId }));

  const paymentId = updated?.id ?? payment?.id;
  if (paymentId && meta.creator_id) {
    try {
      await creditCreatorFromPayment(admin, {
        creatorId: meta.creator_id,
        paymentId,
        grossKobo: amount,
        idempotencyKey: `payment:${paymentId}:credit`,
        description: "Subscription payment",
      });
    } catch (err) {
      logger.error("wallet.subscription_credit_failed", {
        err,
        paymentId,
        creatorId: meta.creator_id,
        grossKobo: amount,
        idempotencyKey: `payment:${paymentId}:credit`,
      });
    }
  }

  // Card fingerprint — fire-and-forget; never blocks payment fulfillment.
  const sig = typeof authorization?.signature === "string" ? authorization.signature : null;
  const authCode = typeof authorization?.authorization_code === "string"
    ? authorization.authorization_code
    : null;
  if (sig && authCode) {
    storeCardFingerprintAndCheck(admin, {
      signature: sig,
      authorizationCode: authCode,
      last4: typeof authorization?.last4 === "string" ? authorization.last4 : null,
      bank: typeof authorization?.bank === "string" ? authorization.bank : null,
      cardType: typeof authorization?.card_type === "string" ? authorization.card_type : null,
      payerId: meta.fan_id,
    }).catch((err) =>
      logger.warn("card_fingerprint.check_failed", { err, fanId: meta.fan_id }),
    );
  }

  return {
    subscriptionId,
    paymentId: paymentId ?? "",
  };
}

export async function failSubscriptionPayment(
  admin: SupabaseClient,
  input: {
    reference: string;
    reason: string;
    requestId?: string | null;
    chargeData?: Record<string, unknown>;
  },
): Promise<void> {
  const payment = await getPaymentByReference(admin, input.reference);
  if (!payment || payment.status !== "pending") return;

  const { error } = await admin
    .from("payments")
    .update({
      status: "failed",
      failure_reason: input.reason.slice(0, 500),
      webhook_processed_at: new Date().toISOString(),
      metadata: {
        ...payment.metadata,
        failed_at: new Date().toISOString(),
        gateway_message: input.reason,
      },
    })
    .eq("id", payment.id)
    .eq("status", "pending");

  if (error) return;

  const giftId =
    typeof payment.metadata?.gift_id === "string"
      ? payment.metadata.gift_id
      : undefined;
  if (giftId) {
    await admin
      .from("subscription_gifts")
      .update({ status: "failed" })
      .eq("id", giftId)
      .eq("status", "pending");
  }

  await writeAuditLog(admin, {
    actorId: payment.payer_id,
    actorType: "user",
    action: "payment.failed",
    entityType: "payments",
    entityId: payment.id,
    requestId: input.requestId,
    afterState: { reference: input.reference, reason: input.reason },
    metadata: input.chargeData ? { gateway: input.chargeData } : {},
  });
}

export async function fulfillTipPayment(
  admin: SupabaseClient,
  input: {
    chargeData: Record<string, unknown>;
    requestId?: string | null;
  },
): Promise<boolean> {
  const meta = parseTipMetadata(input.chargeData);
  if (!meta) return false;

  const reference =
    typeof input.chargeData.reference === "string"
      ? input.chargeData.reference
      : undefined;
  if (!reference) return false;

  const payment = await getPaymentByReference(admin, reference);
  if (!payment) return false;

  // Idempotent: already processed
  if (payment.status === "success") return true;

  const amount =
    typeof input.chargeData.amount === "number"
      ? input.chargeData.amount
      : payment.amount_kobo;

  if (!chargeAmountMatchesPayment(amount, payment.amount_kobo)) return false;

  await admin
    .from("payments")
    .update({
      status: "success",
      webhook_processed_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .eq("status", "pending");

  if (meta.creator_id) {
    try {
      await creditCreatorFromPayment(admin, {
        creatorId: meta.creator_id,
        paymentId: payment.id,
        grossKobo: amount,
        idempotencyKey: `tip:${payment.id}:credit`,
        description: "Fan tip",
      });
    } catch (err) {
      logger.error("wallet.tip_credit_failed", {
        err,
        paymentId: payment.id,
        creatorId: meta.creator_id,
        grossKobo: amount,
        idempotencyKey: `tip:${payment.id}:credit`,
      });
    }

    try {
      const { notifyNewTip } = await import("@/lib/notifications/emit");
      await notifyNewTip(admin, {
        creatorId: meta.creator_id,
        fanId: meta.fan_id,
        amountKobo: amount,
        paymentId: payment.id,
      });
    } catch (err) {
      logger.warn("notifications.tip_failed", { err, paymentId: payment.id });
    }
  }

  await writeAuditLog(admin, {
    actorId: meta.fan_id,
    actorType: "user",
    action: "payment.tip_received",
    entityType: "payments",
    entityId: payment.id,
    requestId: input.requestId,
    afterState: { amount_kobo: amount, creator_id: meta.creator_id },
  });

  return true;
}

export async function recordSubscriptionRenewal(
  admin: SupabaseClient,
  input: {
    subscriptionId: string;
    fanId: string;
    creatorId: string;
    amountKobo: number;
    paystackReference: string;
    paystackTransactionId?: string;
    billingInterval: PlanBillingInterval;
    requestId?: string | null;
  },
): Promise<void> {
  const idempotencyKey = `renewal:${input.paystackReference}`;

  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  let renewalPaymentId: string | null = existing?.id ?? null;

  if (!existing) {
    const { data: inserted } = await admin
      .from("payments")
      .insert({
        payer_id: input.fanId,
        paystack_reference: input.paystackReference,
        paystack_transaction_id: input.paystackTransactionId ?? null,
        amount_kobo: input.amountKobo,
        currency: "NGN",
        type: "subscription",
        status: "success",
        creator_id: input.creatorId,
        subscription_id: input.subscriptionId,
        idempotency_key: idempotencyKey,
        verified_at: new Date().toISOString(),
        webhook_processed_at: new Date().toISOString(),
        metadata: {
          purpose: "subscription_renewal",
          billing_interval: input.billingInterval,
        },
      })
      .select("id")
      .single();
    renewalPaymentId = inserted?.id ?? null;
  }

  await renewSubscriptionPeriod(
    admin,
    input.subscriptionId,
    input.billingInterval,
  );

  await logSubscriptionEvent(admin, input.subscriptionId, "renewed", {
    reference: input.paystackReference,
    amount_kobo: input.amountKobo,
  });

  await writeAuditLog(admin, {
    actorId: input.fanId,
    actorType: "user",
    action: "subscription.renewed",
    entityType: "subscriptions",
    entityId: input.subscriptionId,
    requestId: input.requestId,
    metadata: {
      reference: input.paystackReference,
      amount_kobo: input.amountKobo,
    },
  });

  if (renewalPaymentId) {
    try {
      await creditCreatorFromPayment(admin, {
        creatorId: input.creatorId,
        paymentId: renewalPaymentId,
        grossKobo: input.amountKobo,
        idempotencyKey: `payment:${renewalPaymentId}:credit`,
        description: "Subscription renewal",
      });
    } catch (err) {
      logger.error("wallet.renewal_credit_failed", {
        err,
        paymentId: renewalPaymentId,
        creatorId: input.creatorId,
        grossKobo: input.amountKobo,
        idempotencyKey: `payment:${renewalPaymentId}:credit`,
      });
    }
  }
}
