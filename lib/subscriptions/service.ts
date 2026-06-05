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

  const reference = buildPaymentReference();
  const callbackUrl = `${APP_URL}/subscriptions?checkout=success&reference=${encodeURIComponent(reference)}`;

  const { data: paymentRow, error: paymentError } = await supabase
    .from("payments")
    .insert({
      payer_id: input.fanId,
      paystack_reference: reference,
      amount_kobo: plan.price_kobo,
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
    amountKobo: plan.price_kobo,
    reference,
    callbackUrl,
    metadata: {
      fan_id: input.fanId,
      plan_id: plan.id,
      creator_id: plan.creator_id,
      billing_interval: plan.billing_interval,
      purpose: "subscription_checkout",
    },
  });

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
