import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeSocialLinks } from "@/lib/creators/format";
import {
  postgrestIlikePattern,
  sanitizePostgrestIlikeTerm,
} from "@/lib/security/postgrest-search";
import type {
  CreatorListItem,
  CreatorProfilePublic,
  SocialLinks,
  SubscriptionPlanPublic,
} from "@/types/creator";

type ProfileSnippet = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  deleted_at: string | null;
};

type CreatorJoinRow = {
  user_id: string;
  bio: string | null;
  is_verified: boolean;
  profiles: ProfileSnippet | ProfileSnippet[];
};

function getProfileSnippet(
  profiles: ProfileSnippet | ProfileSnippet[],
): ProfileSnippet {
  return Array.isArray(profiles) ? profiles[0] : profiles;
}

export async function listCreators(
  supabase: SupabaseClient,
  options?: { limit?: number; search?: string },
): Promise<CreatorListItem[]> {
  const limit = options?.limit ?? 24;

  let query = supabase
    .from("creator_profiles")
    .select(
      `
      user_id,
      bio,
      is_verified,
      profiles!inner (
        username,
        display_name,
        avatar_url,
        status,
        deleted_at,
        role
      )
    `,
    )
    .eq("profiles.role", "creator")
    .eq("profiles.status", "active")
    .is("profiles.deleted_at", null)
    .eq("is_accepting_subscribers", true)
    .limit(limit);

  const searchTerm = options?.search?.trim()
    ? sanitizePostgrestIlikeTerm(options.search.trim())
    : null;
  if (searchTerm) {
    const pattern = postgrestIlikePattern(searchTerm);
    query = query.or(
      `profiles.username.ilike.${pattern},profiles.display_name.ilike.${pattern}`,
    );
  }

  const { data, error } = await query;

  if (error || !data) return [];

  const userIds = data.map((row) => row.user_id);
  const { data: planStats } = await supabase
    .from("subscription_plans")
    .select("creator_id, price_kobo")
    .in("creator_id", userIds)
    .eq("is_active", true);

  const statsByCreator = new Map<string, { count: number; min: number }>();
  for (const plan of planStats ?? []) {
    const current = statsByCreator.get(plan.creator_id) ?? {
      count: 0,
      min: plan.price_kobo,
    };
    current.count += 1;
    current.min = Math.min(current.min, plan.price_kobo);
    statsByCreator.set(plan.creator_id, current);
  }

  // Check which creators are currently live
  const { data: liveRows } = await supabase
    .from("live_streams")
    .select("creator_id")
    .eq("status", "live")
    .in("creator_id", userIds);

  const liveSet = new Set((liveRows ?? []).map((r) => r.creator_id));

  return data.map((row) => {
    const profile = getProfileSnippet(
      row.profiles as ProfileSnippet | ProfileSnippet[],
    );
    const stats = statsByCreator.get(row.user_id);
    return {
      user_id: row.user_id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: row.bio,
      is_verified: row.is_verified,
      plan_count: stats?.count ?? 0,
      min_price_kobo: stats?.min ?? null,
      is_live: liveSet.has(row.user_id),
    };
  });
}

export async function getCreatorByUsername(
  supabase: SupabaseClient,
  username: string,
): Promise<CreatorProfilePublic | null> {
  const normalized = username.toLowerCase();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, status, role, deleted_at")
    .eq("username", normalized)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.deleted_at ||
    profile.status !== "active" ||
    profile.role !== "creator"
  ) {
    return null;
  }

  const { data: creator, error: creatorError } = await supabase
    .from("creator_profiles")
    .select(
      "user_id, bio, banner_url, is_verified, is_accepting_subscribers, social_links",
    )
    .eq("user_id", profile.id)
    .maybeSingle();

  if (creatorError || !creator) return null;

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select(
      "id, name, description, price_kobo, currency, billing_interval, benefits, trial_days, sort_order",
    )
    .eq("creator_id", profile.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return {
    user_id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    bio: creator.bio,
    banner_url: creator.banner_url,
    is_verified: creator.is_verified,
    is_accepting_subscribers: creator.is_accepting_subscribers,
    social_links: normalizeSocialLinks(
      creator.social_links,
    ) as SocialLinks,
    plans: (plans ?? []) as SubscriptionPlanPublic[],
  };
}

export async function getCreatorStudioProfile(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, role")
    .eq("id", userId)
    .single();

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("creator_id", userId)
    .order("sort_order", { ascending: true });

  return { profile, creator, plans: plans ?? [] };
}
