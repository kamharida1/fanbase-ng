import type { SupabaseClient } from "@supabase/supabase-js";

import { disablePaystackSubscription } from "@/lib/paystack/plans";
import { logSubscriptionEvent } from "@/lib/subscriptions/events";
import { addPeriod, extendPeriod, pastDueGraceEnds } from "@/lib/subscriptions/period";
import type { PlanBillingInterval, SubscriptionPlanRow } from "@/types/subscription";

type SubscriptionRow = {
  id: string;
  fan_id: string;
  creator_id: string;
  plan_id: string;
  status: string;
  billing_interval: PlanBillingInterval;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  paystack_subscription_code: string | null;
};

export async function getBlockingSubscription(
  supabase: SupabaseClient,
  fanId: string,
  creatorId: string,
): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "id, fan_id, creator_id, plan_id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, paystack_subscription_code",
    )
    .eq("fan_id", fanId)
    .eq("creator_id", creatorId)
    .in("status", ["trialing", "active", "past_due"])
    .maybeSingle();

  return data as SubscriptionRow | null;
}

export async function activateSubscription(
  supabase: SupabaseClient,
  input: {
    fanId: string;
    plan: SubscriptionPlanRow;
    paystackSubscriptionCode?: string | null;
    paystackCustomerCode?: string | null;
    renewExistingId?: string;
    periodOverride?: { start: Date; end: Date };
    cancelAtPeriodEnd?: boolean;
  },
): Promise<{ subscriptionId: string }> {
  const now = new Date();
  const trialDays =
    input.plan.billing_interval !== "free" && !input.periodOverride
      ? input.plan.trial_days
      : 0;
  const { start, end } =
    input.periodOverride ??
    addPeriod(now, input.plan.billing_interval, trialDays);

  const status = trialDays > 0 ? "trialing" : "active";
  const cancelAtPeriodEnd = input.cancelAtPeriodEnd ?? false;

  const payload = {
    fan_id: input.fanId,
    creator_id: input.plan.creator_id,
    plan_id: input.plan.id,
    billing_interval: input.plan.billing_interval,
    status,
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    cancel_at_period_end: cancelAtPeriodEnd,
    cancelled_at: null,
    ended_at: null,
    paystack_subscription_code: input.paystackSubscriptionCode ?? null,
    paystack_customer_code: input.paystackCustomerCode ?? null,
  };

  if (input.renewExistingId) {
    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        plan_id: input.plan.id,
        billing_interval: input.plan.billing_interval,
        status: "active",
        current_period_start: start.toISOString(),
        current_period_end: end.toISOString(),
        cancel_at_period_end: cancelAtPeriodEnd,
        cancelled_at: null,
        ended_at: null,
        paystack_subscription_code:
          input.paystackSubscriptionCode ?? undefined,
        paystack_customer_code: input.paystackCustomerCode ?? undefined,
      })
      .eq("id", input.renewExistingId)
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    await logSubscriptionEvent(supabase, data.id, "renewed", {
      billing_interval: input.plan.billing_interval,
    });
    return { subscriptionId: data.id };
  }

  const existing = await getBlockingSubscription(
    supabase,
    input.fanId,
    input.plan.creator_id,
  );
  if (existing) {
    throw new Error("You already have an active subscription to this creator.");
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logSubscriptionEvent(supabase, data.id, "activated", {
    billing_interval: input.plan.billing_interval,
    trial_days: trialDays,
  });

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { notifyNewSubscriber } = await import("@/lib/notifications/emit");
    const admin = createAdminClient();
    await notifyNewSubscriber(admin, {
      creatorId: input.plan.creator_id,
      fanId: input.fanId,
      subscriptionId: data.id,
      planName: input.plan.name,
    });
  } catch (err) {
    console.error("[notifications] new subscriber", err);
  }

  return { subscriptionId: data.id };
}

export async function renewSubscriptionPeriod(
  supabase: SupabaseClient,
  subscriptionId: string,
  billingInterval: PlanBillingInterval,
): Promise<void> {
  const { data: sub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("id, current_period_end, cancel_at_period_end, status")
    .eq("id", subscriptionId)
    .single();

  if (fetchError || !sub) throw new Error("Subscription not found.");

  const currentEnd = sub.current_period_end
    ? new Date(sub.current_period_end)
    : null;
  const { start, end } = extendPeriod(currentEnd, billingInterval);

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: start.toISOString(),
      current_period_end: end.toISOString(),
      cancel_at_period_end: false,
      ended_at: null,
    })
    .eq("id", subscriptionId);

  if (error) throw new Error(error.message);

  await logSubscriptionEvent(supabase, subscriptionId, "renewed", {
    period_end: end.toISOString(),
  });
}

export async function cancelSubscriptionAtPeriodEnd(
  supabase: SupabaseClient,
  subscriptionId: string,
  fanId: string,
): Promise<void> {
  const { data: sub, error: fetchError } = await supabase
    .from("subscriptions")
    .select(
      "id, fan_id, status, paystack_subscription_code, cancel_at_period_end",
    )
    .eq("id", subscriptionId)
    .eq("fan_id", fanId)
    .single();

  if (fetchError || !sub) throw new Error("Subscription not found.");

  if (!["trialing", "active", "past_due"].includes(sub.status)) {
    throw new Error("This subscription is not active.");
  }

  if (sub.cancel_at_period_end) {
    return;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) throw new Error(error.message);

  if (sub.paystack_subscription_code) {
    try {
      await disablePaystackSubscription(sub.paystack_subscription_code);
    } catch (err) {
      console.error("[paystack] disable subscription failed", err);
    }
  }

  await logSubscriptionEvent(supabase, subscriptionId, "cancel_scheduled", {});
}

export async function pauseSubscription(
  supabase: SupabaseClient,
  subscriptionId: string,
  fanId: string,
): Promise<void> {
  const { data: sub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("id, fan_id, status, current_period_end")
    .eq("id", subscriptionId)
    .eq("fan_id", fanId)
    .single();

  if (fetchError || !sub) throw new Error("Subscription not found.");
  if (!["trialing", "active"].includes(sub.status)) {
    throw new Error("Only active or trialing subscriptions can be paused.");
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "paused", paused_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  if (error) throw new Error(error.message);
  await logSubscriptionEvent(supabase, subscriptionId, "paused" as never, {});
}

export async function resumeSubscription(
  supabase: SupabaseClient,
  subscriptionId: string,
  fanId: string,
): Promise<void> {
  const { data: sub, error: fetchError } = await supabase
    .from("subscriptions")
    .select("id, fan_id, status, current_period_end")
    .eq("id", subscriptionId)
    .eq("fan_id", fanId)
    .single();

  if (fetchError || !sub) throw new Error("Subscription not found.");
  if (sub.status !== "paused") {
    throw new Error("Subscription is not paused.");
  }

  // If the period has already ended, set to expired instead
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end)
    : null;
  if (periodEnd && periodEnd.getTime() < Date.now()) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "expired", ended_at: new Date().toISOString(), paused_at: null })
      .eq("id", subscriptionId);
    if (error) throw new Error(error.message);
    await logSubscriptionEvent(supabase, subscriptionId, "expired" as never, {
      reason: "resumed_after_period_end",
    });
    return;
  }

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "active", paused_at: null })
    .eq("id", subscriptionId);

  if (error) throw new Error(error.message);
  await logSubscriptionEvent(supabase, subscriptionId, "resumed" as never, {});
}

export async function expireEndedSubscriptions(
  supabase: SupabaseClient,
): Promise<{ expired: number; pastDue: number }> {
  const nowIso = new Date().toISOString();
  let pastDue = 0;
  let expired = 0;

  const { data: dueRows } = await supabase
    .from("subscriptions")
    .select("id, status, current_period_end, cancel_at_period_end")
    .in("status", ["active", "trialing"])
    .lt("current_period_end", nowIso)
    .eq("cancel_at_period_end", false);

  for (const row of dueRows ?? []) {
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "past_due" })
      .eq("id", row.id);
    if (!error) {
      pastDue += 1;
      await logSubscriptionEvent(supabase, row.id, "past_due", {});
    }
  }

  const { data: cancelRows } = await supabase
    .from("subscriptions")
    .select("id")
    .in("status", ["active", "trialing", "past_due"])
    .eq("cancel_at_period_end", true)
    .lt("current_period_end", nowIso);

  for (const row of cancelRows ?? []) {
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "expired",
        ended_at: nowIso,
      })
      .eq("id", row.id);
    if (!error) {
      expired += 1;
      await logSubscriptionEvent(supabase, row.id, "expired", {
        reason: "cancel_at_period_end",
      });
    }
  }

  const { data: graceRows } = await supabase
    .from("subscriptions")
    .select("id, fan_id, creator_id, current_period_end, subscription_plans (name)")
    .eq("status", "past_due");

  for (const row of graceRows ?? []) {
    if (!row.current_period_end) continue;
    const graceEnd = pastDueGraceEnds(new Date(row.current_period_end));
    if (graceEnd.getTime() > Date.now()) continue;

    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "expired",
        ended_at: nowIso,
      })
      .eq("id", row.id);

    if (!error) {
      expired += 1;
      await logSubscriptionEvent(supabase, row.id, "expired", {
        reason: "past_due_grace_elapsed",
      });

      try {
        const planRaw = row.subscription_plans as
          | { name: string }
          | { name: string }[]
          | null;
        const planName = Array.isArray(planRaw) ? planRaw[0]?.name : planRaw?.name;
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const { notifySubscriptionEndedFromNonPayment } = await import(
          "@/lib/notifications/emit"
        );
        const admin = createAdminClient();
        await notifySubscriptionEndedFromNonPayment(admin, {
          fanId: row.fan_id,
          creatorId: row.creator_id,
          subscriptionId: row.id,
          planName: planName ?? "your plan",
        });
      } catch (err) {
        console.error("[notifications] subscription ended (non-payment)", err);
      }
    }
  }

  return { expired, pastDue };
}
