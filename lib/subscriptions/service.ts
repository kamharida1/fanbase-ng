import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import {
  buildPaymentReference,
  createPaystackSubscription,
  initializeSubscriptionCheckout,
} from "@/lib/paystack/checkout";
import { createPaystackPlan } from "@/lib/paystack/plans";
import { activateSubscription } from "@/lib/subscriptions/lifecycle";
import { getBlockingSubscription } from "@/lib/subscriptions/lifecycle";
import type { SubscriptionPlanRow } from "@/types/subscription";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function fetchPlanForSubscribe(
  supabase: SupabaseClient,
  planId: string,
): Promise<SubscriptionPlanRow | null> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(
      "id, creator_id, name, description, price_kobo, currency, billing_interval, paystack_plan_code, benefits, sort_order, is_active, trial_days",
    )
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as SubscriptionPlanRow;
}

export async function ensurePaystackPlanCode(
  supabase: SupabaseClient,
  plan: SubscriptionPlanRow,
): Promise<string | null> {
  if (plan.billing_interval === "free") return null;
  if (plan.paystack_plan_code) return plan.paystack_plan_code;

  const code = await createPaystackPlan({
    name: plan.name,
    priceKobo: plan.price_kobo,
    billingInterval: plan.billing_interval,
  });

  await supabase
    .from("subscription_plans")
    .update({ paystack_plan_code: code })
    .eq("id", plan.id);

  return code;
}

export type SubscribeResult =
  | { type: "active"; subscriptionId: string }
  | { type: "checkout"; authorizationUrl: string; reference: string };

export async function startSubscription(
  supabase: SupabaseClient,
  input: {
    fanId: string;
    fanEmail: string;
    planId: string;
    offerId?: string;
    bundleId?: string;
  },
): Promise<SubscribeResult> {
  const plan = await fetchPlanForSubscribe(supabase, input.planId);
  if (!plan) {
    throw new Error("Plan not found or is no longer available.");
  }

  if (plan.creator_id === input.fanId) {
    throw new Error("You cannot subscribe to your own profile.");
  }

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("is_accepting_subscribers")
    .eq("user_id", plan.creator_id)
    .single();

  if (!creator?.is_accepting_subscribers) {
    throw new Error("This creator is not accepting new subscribers.");
  }

  // Check if this fan is blocked by the creator
  const { isFanBlocked } = await import("@/lib/fans/queries");
  const blocked = await isFanBlocked(supabase, plan.creator_id, input.fanId);
  if (blocked) {
    throw new Error("You cannot subscribe to this creator.");
  }

  const blocking = await getBlockingSubscription(
    supabase,
    input.fanId,
    plan.creator_id,
  );
  if (blocking) {
    throw new Error("You already have an active subscription to this creator.");
  }

  if (plan.billing_interval === "free") {
    const { subscriptionId } = await activateSubscription(supabase, {
      fanId: input.fanId,
      plan,
    });
    return { type: "active", subscriptionId };
  }

  // Apply offer discount (first month only; renewals bill at full plan price)
  let checkoutAmountKobo = plan.price_kobo;
  let appliedOfferId: string | null = null;
  let bundleMonths: number | null = null;

  if (
    input.bundleId &&
    plan.billing_interval === "monthly"
  ) {
    const { getBundleById } = await import("@/lib/subscriptions/bundles");
    const bundle = await getBundleById(supabase, input.bundleId);
    if (bundle && bundle.plan_id === plan.id) {
      checkoutAmountKobo = Math.round(
        plan.price_kobo * bundle.months * (1 - bundle.discount_pct / 100),
      );
      bundleMonths = bundle.months;
    }
  } else if (
    input.offerId &&
    (plan.billing_interval === "monthly" || plan.billing_interval === "annual")
  ) {
    const { getOfferById } = await import("@/lib/offers/queries");
    const offer = await getOfferById(supabase, input.offerId);
    if (offer && offer.plan_id === plan.id) {
      checkoutAmountKobo = Math.round(
        plan.price_kobo * (1 - offer.discount_pct / 100),
      );
      appliedOfferId = offer.id;
    }
  }

  const reference = buildPaymentReference();
  const callbackUrl = `${APP_URL}/subscriptions?checkout=success&reference=${encodeURIComponent(reference)}`;

  const { data: paymentRow, error: paymentError } = await supabase
    .from("payments")
    .insert({
      payer_id: input.fanId,
      paystack_reference: reference,
      amount_kobo: checkoutAmountKobo,
      currency: plan.currency,
      type: "subscription",
      status: "pending",
      creator_id: plan.creator_id,
      idempotency_key: reference,
      metadata: {
        plan_id: plan.id,
        billing_interval: plan.billing_interval,
        purpose: "subscription_checkout",
        fan_id: input.fanId,
        creator_id: plan.creator_id,
        ...(appliedOfferId ? { offer_id: appliedOfferId } : {}),
        ...(bundleMonths ? { bundle_months: bundleMonths } : {}),
      },
    })
    .select("id")
    .single();

  if (paymentError) {
    throw new Error("Could not start checkout. Please try again.");
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    await writeAuditLog(admin, {
      actorId: input.fanId,
      actorType: "user",
      action: "payment.initialized",
      entityType: "payments",
      entityId: paymentRow.id,
      afterState: {
        reference,
        amount_kobo: plan.price_kobo,
        plan_id: plan.id,
      },
    });
  } catch {
    // Audit is best-effort when service role is not configured locally.
  }

  const checkout = await initializeSubscriptionCheckout({
    email: input.fanEmail,
    amountKobo: checkoutAmountKobo,
    reference,
    callbackUrl,
    metadata: {
      fan_id: input.fanId,
      plan_id: plan.id,
      creator_id: plan.creator_id,
      billing_interval: plan.billing_interval,
      purpose: "subscription_checkout",
      ...(appliedOfferId ? { offer_id: appliedOfferId } : {}),
      ...(bundleMonths ? { bundle_months: bundleMonths } : {}),
    },
  });

  // Record offer redemption
  if (appliedOfferId) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const admin = createAdminClient();
      const { error: rpcErr } = await admin.rpc("increment_offer_redemption", {
        offer_id: appliedOfferId,
      });
      if (rpcErr) {
        await admin
          .from("subscription_offers")
          .update({ redemption_count: 999 })
          .eq("id", appliedOfferId!);
      }
    } catch {
      // non-critical
    }
  }

  return {
    type: "checkout",
    authorizationUrl: checkout.authorization_url,
    reference: checkout.reference,
  };
}

export async function completePaidSubscription(
  admin: SupabaseClient,
  input: {
    fanId: string;
    planId: string;
    paystackReference: string;
    paystackTransactionId?: string;
    paystackCustomerCode?: string;
    authorizationCode?: string;
    amountKobo: number;
    bundleMonths?: number;
    giftId?: string;
  },
): Promise<string> {
  const plan = await fetchPlanForSubscribe(admin, input.planId);
  if (!plan) throw new Error("Plan not found.");

  const { data: existingPayment } = await admin
    .from("payments")
    .select("id, status, subscription_id")
    .eq("paystack_reference", input.paystackReference)
    .maybeSingle();

  if (existingPayment?.status === "success" && existingPayment.subscription_id) {
    return existingPayment.subscription_id;
  }

  // Gift purchases hand the prepaid grant to a recipient chosen by the payer.
  // Look up the gift record (source of truth for who/how-long) before
  // falling into the same one-time prepaid-grant mechanics as bundles.
  let giftRecipientId: string | null = null;
  let giftMonths: number | null = null;
  if (input.giftId) {
    const { data: gift } = await admin
      .from("subscription_gifts")
      .select("id, recipient_id, months, status")
      .eq("id", input.giftId)
      .maybeSingle();

    if (gift && gift.status === "pending") {
      giftRecipientId = gift.recipient_id;
      giftMonths = gift.months;
    }
  }

  const prepaidMonths = input.bundleMonths ?? giftMonths;

  // Bundle and gift purchases are one-time prepaid charges — no recurring
  // Paystack subscription is created, and the period spans the full prepaid
  // duration rather than the plan's regular billing interval. Gifts target
  // the recipient's account; bundles target the payer's own account.
  if (prepaidMonths) {
    const targetFanId = giftRecipientId ?? input.fanId;
    const { addBundlePeriod } = await import("@/lib/subscriptions/period");
    const blocking = await getBlockingSubscription(
      admin,
      targetFanId,
      plan.creator_id,
    );
    const anchor =
      blocking?.current_period_end &&
      new Date(blocking.current_period_end).getTime() > Date.now()
        ? new Date(blocking.current_period_end)
        : new Date();

    const { subscriptionId } = await activateSubscription(admin, {
      fanId: targetFanId,
      plan,
      periodOverride: addBundlePeriod(anchor, prepaidMonths),
      cancelAtPeriodEnd: true,
      renewExistingId: blocking?.id,
    });

    if (input.giftId && giftRecipientId) {
      await admin
        .from("subscription_gifts")
        .update({
          status: "fulfilled",
          subscription_id: subscriptionId,
          fulfilled_at: new Date().toISOString(),
        })
        .eq("id", input.giftId);

      try {
        const { notifyGiftSubscription } = await import("@/lib/notifications/emit");
        await notifyGiftSubscription(admin, {
          recipientId: giftRecipientId,
          gifterId: input.fanId,
          creatorId: plan.creator_id,
          planName: plan.name,
          months: giftMonths ?? prepaidMonths,
          subscriptionId,
        });
      } catch (err) {
        console.error("[notifications] gift subscription", err);
      }
    }

    await admin
      .from("payments")
      .update({
        status: "success",
        subscription_id: subscriptionId,
        paystack_transaction_id: input.paystackTransactionId ?? null,
        webhook_processed_at: new Date().toISOString(),
        amount_kobo: input.amountKobo,
      })
      .eq("paystack_reference", input.paystackReference);

    return subscriptionId;
  }

  let paystackSubscriptionCode: string | null = null;

  if (
    plan.billing_interval === "monthly" &&
    input.authorizationCode
  ) {
    const planCode = await ensurePaystackPlanCode(admin, plan);
    if (planCode) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", input.fanId)
        .single();

      const { data: authUser } = await admin.auth.admin.getUserById(
        input.fanId,
      );
      const email = authUser?.user?.email;
      if (email) {
        try {
          const sub = await createPaystackSubscription({
            customerEmail: email,
            planCode,
            authorizationCode: input.authorizationCode,
          });
          paystackSubscriptionCode = sub.subscription_code;
        } catch (err) {
          console.error("[paystack] create subscription", err, profile?.id);
        }
      }
    }
  }

  const blocking = await getBlockingSubscription(
    admin,
    input.fanId,
    plan.creator_id,
  );

  const { subscriptionId } = await activateSubscription(admin, {
    fanId: input.fanId,
    plan,
    paystackSubscriptionCode,
    paystackCustomerCode: input.paystackCustomerCode ?? null,
    renewExistingId: blocking?.id,
  });

  await admin
    .from("payments")
    .update({
      status: "success",
      subscription_id: subscriptionId,
      paystack_transaction_id: input.paystackTransactionId ?? null,
      webhook_processed_at: new Date().toISOString(),
      amount_kobo: input.amountKobo,
    })
    .eq("paystack_reference", input.paystackReference);

  return subscriptionId;
}
