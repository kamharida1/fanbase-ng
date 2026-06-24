import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeSocialLinks } from "@/lib/creators/format";
import { normalizeMediaUrl } from "@/lib/media/delivery-url";
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

type CreatorPageCursor = { createdAt: string; userId: string };

export function encodeCreatorCursor(cursor: CreatorPageCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCreatorCursor(
  encoded: string | null | undefined,
): CreatorPageCursor | null {
  if (!encoded?.trim()) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as CreatorPageCursor;
    if (typeof parsed.createdAt !== "string" || typeof parsed.userId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function queryCreators(
  supabase: SupabaseClient,
  options: {
    limit: number;
    search?: string;
    category?: string;
    cursor?: CreatorPageCursor | null;
  },
): Promise<(CreatorJoinRow & { created_at: string })[]> {
  let query = supabase
    .from("creator_profiles")
    .select(
      `
      user_id,
      bio,
      is_verified,
      category,
      created_at,
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
    .order("created_at", { ascending: false })
    .order("user_id", { ascending: false })
    .limit(options.limit);

  // Category filter — uses GIN index on creator_profiles.category
  if (options.category) {
    query = query.contains("category", [options.category]);
  }

  const searchTerm = options.search?.trim()
    ? sanitizePostgrestIlikeTerm(options.search.trim())
    : null;
  if (searchTerm) {
    const pattern = postgrestIlikePattern(searchTerm);
    query = query.or(
      `profiles.username.ilike.${pattern},profiles.display_name.ilike.${pattern}`,
    );
  }

  if (options.cursor) {
    query = query.or(
      `created_at.lt.${options.cursor.createdAt},and(created_at.eq.${options.cursor.createdAt},user_id.lt.${options.cursor.userId})`,
    );
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as unknown as (CreatorJoinRow & { created_at: string })[];
}

async function hydrateCreators(
  supabase: SupabaseClient,
  data: (CreatorJoinRow & { created_at: string })[],
): Promise<CreatorListItem[]> {
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
      categories: (row as { category?: string[] }).category ?? [],
    };
  });
}

export async function listCreators(
  supabase: SupabaseClient,
  options?: { limit?: number; search?: string; category?: string },
): Promise<CreatorListItem[]> {
  const data = await queryCreators(supabase, {
    limit: options?.limit ?? 24,
    search: options?.search,
    category: options?.category,
  });
  return hydrateCreators(supabase, data);
}

export async function listCreatorsPage(
  supabase: SupabaseClient,
  options: { limit?: number; search?: string; category?: string; cursor?: string | null },
): Promise<{ creators: CreatorListItem[]; nextCursor: string | null; hasMore: boolean }> {
  const limit = options.limit ?? 24;
  const cursor = decodeCreatorCursor(options.cursor);

  const rows = await queryCreators(supabase, {
    limit: limit + 1,
    search: options.search,
    category: options.category,
    cursor,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const creators = await hydrateCreators(supabase, pageRows);

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCreatorCursor({ createdAt: last.created_at, userId: last.user_id })
      : null;

  return { creators, nextCursor, hasMore };
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
    avatar_url: normalizeMediaUrl(profile.avatar_url),
    bio: creator.bio,
    banner_url: normalizeMediaUrl(creator.banner_url),
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
    .select("id, username, display_name, avatar_url, role, kyc_status, verification_note, verification_rejected_reason")
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
