import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriberRow = {
  fan_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  subscription_status: string;
  subscribed_at: string;
  is_blocked: boolean;
};

export async function listCreatorFans(
  admin: SupabaseClient,
  creatorId: string,
  limit = 50,
): Promise<SubscriberRow[]> {
  const { data: subs } = await admin
    .from("subscriptions")
    .select("fan_id, status, created_at")
    .eq("creator_id", creatorId)
    .in("status", ["active", "trialing", "past_due", "cancelled", "expired"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!subs?.length) return [];

  const fanIds = subs.map((s) => s.fan_id);

  const [{ data: profiles }, { data: blocks }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", fanIds),
    admin
      .from("creator_blocks")
      .select("fan_id")
      .eq("creator_id", creatorId)
      .in("fan_id", fanIds),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );
  const blockedSet = new Set((blocks ?? []).map((b) => b.fan_id));

  return subs.flatMap((sub) => {
    const profile = profileMap.get(sub.fan_id);
    if (!profile) return [];
    return [
      {
        fan_id: sub.fan_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        subscription_status: sub.status,
        subscribed_at: sub.created_at,
        is_blocked: blockedSet.has(sub.fan_id),
      },
    ];
  });
}

export async function isFanBlocked(
  supabase: SupabaseClient,
  creatorId: string,
  fanId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("creator_blocks")
    .select("creator_id")
    .eq("creator_id", creatorId)
    .eq("fan_id", fanId)
    .maybeSingle();
  return Boolean(data);
}
