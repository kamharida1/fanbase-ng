import type { SupabaseClient } from "@supabase/supabase-js";

import { isSubscriptionAccessActive } from "@/lib/subscriptions/access";
import type { FanSubscriptionRow } from "@/types/subscription";

export async function listFanSubscriptions(
  supabase: SupabaseClient,
  fanId: string,
): Promise<FanSubscriptionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      fan_id,
      creator_id,
      plan_id,
      status,
      billing_interval,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      cancelled_at,
      ended_at,
      created_at,
      subscription_plans (
        id,
        name,
        price_kobo,
        billing_interval
      )
    `,
    )
    .eq("fan_id", fanId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const creatorIds = [...new Set(data.map((r) => r.creator_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", creatorIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  return data.map((row) => {
    const planRaw = row.subscription_plans as
      | {
          id: string;
          name: string;
          price_kobo: number;
          billing_interval: string;
        }
      | {
          id: string;
          name: string;
          price_kobo: number;
          billing_interval: string;
        }[]
      | null;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    const profile = profileById.get(row.creator_id);

    return {
      id: row.id,
      fan_id: row.fan_id,
      creator_id: row.creator_id,
      plan_id: row.plan_id,
      status: row.status,
      billing_interval: row.billing_interval,
      current_period_start: row.current_period_start,
      current_period_end: row.current_period_end,
      cancel_at_period_end: row.cancel_at_period_end,
      cancelled_at: row.cancelled_at,
      ended_at: row.ended_at,
      created_at: row.created_at,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            price_kobo: plan.price_kobo,
            billing_interval:
              plan.billing_interval as FanSubscriptionRow["billing_interval"],
          }
        : undefined,
      creator: profile
        ? {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }
        : undefined,
    };
  });
}

export async function getFanSubscriptionToCreator(
  supabase: SupabaseClient,
  fanId: string,
  creatorId: string,
): Promise<FanSubscriptionRow | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "id, fan_id, creator_id, plan_id, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, ended_at, created_at",
    )
    .eq("fan_id", fanId)
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return data as FanSubscriptionRow;
}

export type CreatorPageSubscriptionState =
  | { kind: "none" }
  | { kind: "active"; subscriptionId: string; planId: string; cancelAtPeriodEnd: boolean }
  | { kind: "inactive"; subscriptionId?: string };

export async function getCreatorPageSubscriptionState(
  supabase: SupabaseClient,
  fanId: string | null,
  creatorId: string,
): Promise<CreatorPageSubscriptionState> {
  if (!fanId) return { kind: "none" };

  const sub = await getFanSubscriptionToCreator(supabase, fanId, creatorId);
  if (!sub) return { kind: "none" };

  if (isSubscriptionAccessActive(sub)) {
    return {
      kind: "active",
      subscriptionId: sub.id,
      planId: sub.plan_id,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  }

  return { kind: "inactive", subscriptionId: sub.id };
}
