import type { SupabaseClient } from "@supabase/supabase-js";

import type { SubscriptionPlanBundleRow } from "@/types/subscription";

const BUNDLE_COLUMNS = "id, plan_id, months, discount_pct, is_active";

export async function listCreatorPlanBundles(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<SubscriptionPlanBundleRow[]> {
  const { data } = await supabase
    .from("subscription_plan_bundles")
    .select(BUNDLE_COLUMNS)
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  return (data ?? []) as SubscriptionPlanBundleRow[];
}

export async function getActivePlanBundles(
  supabase: SupabaseClient,
  planIds: string[],
): Promise<Map<string, SubscriptionPlanBundleRow[]>> {
  const map = new Map<string, SubscriptionPlanBundleRow[]>();
  if (!planIds.length) return map;

  const { data } = await supabase
    .from("subscription_plan_bundles")
    .select(BUNDLE_COLUMNS)
    .in("plan_id", planIds)
    .eq("is_active", true)
    .order("months", { ascending: true });

  for (const bundle of (data ?? []) as SubscriptionPlanBundleRow[]) {
    const existing = map.get(bundle.plan_id) ?? [];
    existing.push(bundle);
    map.set(bundle.plan_id, existing);
  }
  return map;
}

export async function getBundleById(
  supabase: SupabaseClient,
  bundleId: string,
): Promise<SubscriptionPlanBundleRow | null> {
  const { data } = await supabase
    .from("subscription_plan_bundles")
    .select(BUNDLE_COLUMNS)
    .eq("id", bundleId)
    .eq("is_active", true)
    .maybeSingle();

  return data as SubscriptionPlanBundleRow | null;
}
