import type { SupabaseClient } from "@supabase/supabase-js";

import type { SubscriptionStatus } from "@/types/subscription";

const ACTIVE_STATUSES: SubscriptionStatus[] = [
  "trialing",
  "active",
  "past_due",
];

export function isPeriodValid(
  periodEnd: string | null,
  now = new Date(),
): boolean {
  if (!periodEnd) return true;
  return new Date(periodEnd).getTime() > now.getTime();
}

export function isSubscriptionAccessActive(row: {
  status: SubscriptionStatus;
  current_period_end: string | null;
}): boolean {
  if (!ACTIVE_STATUSES.includes(row.status)) return false;
  return isPeriodValid(row.current_period_end);
}

export async function hasActiveSubscription(
  supabase: SupabaseClient,
  fanId: string,
  creatorId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("is_active_subscriber", {
    p_fan_id: fanId,
    p_creator_id: creatorId,
  });

  return Boolean(data);
}

export async function hasPlanAccess(
  supabase: SupabaseClient,
  fanId: string,
  creatorId: string,
  planId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("id, status, current_period_end")
    .eq("fan_id", fanId)
    .eq("creator_id", creatorId)
    .eq("plan_id", planId)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();

  if (!data) return false;
  return isSubscriptionAccessActive(data);
}

export async function canViewPost(
  supabase: SupabaseClient,
  userId: string | null,
  postId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("can_view_post", {
    p_user_id: userId,
    p_post_id: postId,
  });
  return Boolean(data);
}
