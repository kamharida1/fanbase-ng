import type { SupabaseClient } from "@supabase/supabase-js";

export type OfferRow = {
  id: string;
  plan_id: string;
  label: string;
  discount_pct: number;
  ends_at: string;
  max_redemptions: number | null;
  redemption_count: number;
  is_active: boolean;
};

export async function getActivePlanOffers(
  supabase: SupabaseClient,
  planIds: string[],
): Promise<Map<string, OfferRow>> {
  if (!planIds.length) return new Map();

  const { data } = await supabase
    .from("subscription_offers")
    .select(
      "id, plan_id, label, discount_pct, ends_at, max_redemptions, redemption_count, is_active",
    )
    .in("plan_id", planIds)
    .eq("is_active", true)
    .gt("ends_at", new Date().toISOString())
    .order("ends_at", { ascending: true });

  const map = new Map<string, OfferRow>();
  for (const offer of data ?? []) {
    // Only keep first (soonest-expiring) offer per plan
    if (!map.has(offer.plan_id)) {
      if (
        offer.max_redemptions == null ||
        offer.redemption_count < offer.max_redemptions
      ) {
        map.set(offer.plan_id, offer as OfferRow);
      }
    }
  }
  return map;
}

export async function getOfferById(
  supabase: SupabaseClient,
  offerId: string,
): Promise<OfferRow | null> {
  const { data } = await supabase
    .from("subscription_offers")
    .select(
      "id, plan_id, label, discount_pct, ends_at, max_redemptions, redemption_count, is_active",
    )
    .eq("id", offerId)
    .eq("is_active", true)
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return null;
  if (
    data.max_redemptions != null &&
    data.redemption_count >= data.max_redemptions
  ) {
    return null;
  }
  return data as OfferRow;
}

export async function listCreatorOffers(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<OfferRow[]> {
  const { data } = await supabase
    .from("subscription_offers")
    .select(
      "id, plan_id, label, discount_pct, ends_at, max_redemptions, redemption_count, is_active",
    )
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  return (data ?? []) as OfferRow[];
}
