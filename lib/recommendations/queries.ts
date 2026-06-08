import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { enrichPosts } from "@/lib/posts/queries";
import { logger } from "@/lib/logger";
import type { RecommendedCreator } from "@/types/recommendations";
import type { PostRow } from "@/types/posts";

const RECOMMENDATIONS_TTL = 900; // 15 minutes — collaborative filtering is stable

async function fetchRecommendedCreators(
  supabase: SupabaseClient,
  viewerId: string,
  limit: number,
): Promise<RecommendedCreator[]> {
  const { data, error } = await supabase.rpc("get_recommended_creators", {
    p_viewer_id: viewerId,
    p_limit: limit,
  });

  if (error) {
    logger.error("recommendations.get_recommended_creators_failed", { error: error.message });
    return [];
  }

  return (data ?? []) as RecommendedCreator[];
}

export async function getRecommendedCreators(
  supabase: SupabaseClient,
  viewerId: string,
  limit = 8,
): Promise<RecommendedCreator[]> {
  return unstable_cache(
    () => fetchRecommendedCreators(supabase, viewerId, limit),
    [`recommendations:creators:${viewerId}:${limit}`],
    { revalidate: RECOMMENDATIONS_TTL, tags: [`recommendations:${viewerId}`] },
  )();
}

type ForYouPageArgs = {
  fanId: string;
  limit?: number;
  cursorScore?: number | null;
  cursorPublishedAt?: string | null;
  cursorId?: string | null;
};

export async function getForYouPosts(
  supabase: SupabaseClient,
  args: ForYouPageArgs,
): Promise<PostRow[]> {
  const { fanId, limit = 20, cursorScore, cursorPublishedAt, cursorId } = args;

  const { data, error } = await supabase.rpc("get_for_you_posts", {
    p_fan_id: fanId,
    p_limit: limit,
    p_cursor_score: cursorScore ?? null,
    p_cursor_published_at: cursorPublishedAt ?? null,
    p_cursor_id: cursorId ?? null,
  });

  if (error) {
    logger.error("recommendations.get_for_you_posts_failed", { error: error.message });
    return [];
  }

  return enrichPosts(supabase, (data ?? []) as Record<string, unknown>[], fanId);
}
