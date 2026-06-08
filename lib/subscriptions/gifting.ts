import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import {
  buildPaymentReference,
  initializeSubscriptionCheckout,
} from "@/lib/paystack/checkout";
import { fetchPlanForSubscribe } from "@/lib/subscriptions/service";
import type { SubscriptionGiftRow } from "@/types/subscription";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function startGiftSubscription(
  supabase: SupabaseClient,
  input: {
    gifterId: string;
    gifterEmail: string;
    planId: string;
    recipientUsername: string;
    months: 1 | 3 | 6 | 12;
    message?: string;
  },
): Promise<{ authorizationUrl: string; reference: string }> {
  const plan = await fetchPlanForSubscribe(supabase, input.planId);
  if (!plan) {
    throw new Error("Plan not found or is no longer available.");
  }

  if (plan.billing_interval !== "monthly") {
    throw new Error("Gifting is only available for monthly subscription plans.");
  }

  const { data: recipient } = await supabase
    .from("profiles")
    .select("id, username, status, deleted_at")
    .eq("username", input.recipientUsername)
    .maybeSingle();

  if (!recipient || recipient.deleted_at || recipient.status !== "active") {
    throw new Error("We couldn't find a fanbase account with that username.");
  }

  if (recipient.id === input.gifterId) {
    throw new Error("You cannot gift a subscription to yourself.");
  }

  if (recipient.id === plan.creator_id) {
    throw new Error("You cannot gift a creator their own plan.");
  }

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("is_accepting_subscribers")
    .eq("user_id", plan.creator_id)
    .single();

  if (!creator?.is_accepting_subscribers) {
    throw new Error("This creator is not accepting new subscribers.");
  }

  const { isFanBlocked } = await import("@/lib/fans/queries");
  const blocked = await isFanBlocked(supabase, plan.creator_id, recipient.id);
  if (blocked) {
    throw new Error("This creator isn't accepting subscriptions for that account.");
  }

  const amountKobo = plan.price_kobo * input.months;
  const reference = buildPaymentReference().replace("fb_sub_", "fb_gift_");
  const callbackUrl = `${APP_URL}/subscriptions?checkout=success&reference=${encodeURIComponent(reference)}`;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: gift, error: giftError } = await admin
    .from("subscription_gifts")
    .insert({
      gifter_id: input.gifterId,
      recipient_id: recipient.id,
      creator_id: plan.creator_id,
      plan_id: plan.id,
      months: input.months,
      amount_kobo: amountKobo,
      message: input.message ?? null,
    })
    .select("id")
    .single();

  if (giftError || !gift) {
    throw new Error("Could not start gift checkout. Please try again.");
  }

  const { error: paymentError } = await admin.from("payments").insert({
    payer_id: input.gifterId,
    paystack_reference: reference,
    amount_kobo: amountKobo,
    currency: plan.currency,
    type: "subscription",
    status: "pending",
    creator_id: plan.creator_id,
    idempotency_key: reference,
    metadata: {
      plan_id: plan.id,
      billing_interval: plan.billing_interval,
      purpose: "subscription_checkout",
      fan_id: input.gifterId,
      creator_id: plan.creator_id,
      gift_id: gift.id,
    },
  });

  if (paymentError) {
    await admin.from("subscription_gifts").delete().eq("id", gift.id);
    throw new Error("Could not start gift checkout. Please try again.");
  }

  await writeAuditLog(admin, {
    actorId: input.gifterId,
    actorType: "user",
    action: "subscription.gift_initiated",
    entityType: "subscription_gifts",
    entityId: gift.id,
    afterState: {
      reference,
      amount_kobo: amountKobo,
      plan_id: plan.id,
      recipient_id: recipient.id,
      months: input.months,
    },
  });

  const checkout = await initializeSubscriptionCheckout({
    email: input.gifterEmail,
    amountKobo,
    reference,
    callbackUrl,
    metadata: {
      fan_id: input.gifterId,
      plan_id: plan.id,
      creator_id: plan.creator_id,
      billing_interval: plan.billing_interval,
      purpose: "subscription_checkout",
      gift_id: gift.id,
    },
  });

  return {
    authorizationUrl: checkout.authorization_url,
    reference: checkout.reference,
  };
}

export async function listGiftsSentByUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionGiftRow[]> {
  const { data: gifts } = await supabase
    .from("subscription_gifts")
    .select(
      "id, gifter_id, recipient_id, creator_id, plan_id, months, amount_kobo, message, status, fulfilled_at, created_at",
    )
    .eq("gifter_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!gifts || gifts.length === 0) return [];

  const recipientIds = [...new Set(gifts.map((g) => g.recipient_id))];
  const planIds = [...new Set(gifts.map((g) => g.plan_id))];

  const [{ data: recipients }, { data: plans }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", recipientIds),
    supabase
      .from("subscription_plans")
      .select("id, name, billing_interval")
      .in("id", planIds),
  ]);

  const recipientMap = new Map((recipients ?? []).map((r) => [r.id, r]));
  const planMap = new Map((plans ?? []).map((p) => [p.id, p]));

  return gifts.map((g) => {
    const recipient = recipientMap.get(g.recipient_id);
    const plan = planMap.get(g.plan_id);
    return {
      ...g,
      recipient: recipient
        ? {
            username: recipient.username,
            display_name: recipient.display_name,
            avatar_url: recipient.avatar_url,
          }
        : undefined,
      plan: plan
        ? { id: plan.id, name: plan.name, billing_interval: plan.billing_interval }
        : undefined,
    };
  }) as SubscriptionGiftRow[];
}
