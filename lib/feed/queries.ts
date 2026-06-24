import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FEED_CACHE_SECONDS,
  FEED_MAX_PAGE_SIZE,
  FEED_PAGE_SIZE,
} from "@/lib/feed/constants";
import { FeedUnavailableError } from "@/lib/feed/errors";
import { logger } from "@/lib/logger";
import { cursorFromRow, decodeFeedCursor, encodeFeedCursor } from "@/lib/feed/cursor";
import { enrichPosts } from "@/lib/posts/queries";
import type { FeedPage } from "@/types/feed";
import type { PostRow } from "@/types/posts";

type RankedFeedRow = {
  id: string;
  creator_id: string;
  type: string;
  caption: string | null;
  content_warning: string | null;
  visibility: string;
  plan_id: string | null;
  ppv_price_kobo: number | null;
  status: string;
  moderation_status: string;
  published_at: string;
  scheduled_publish_at: string | null;
  stats_cache: unknown;
  created_at: string;
  updated_at: string;
  feed_score: number;
};

async function fetchRankedFeedRows(
  supabase: SupabaseClient,
  input: {
    fanId: string;
    limit: number;
    cursor: ReturnType<typeof decodeFeedCursor>;
  },
): Promise<RankedFeedRow[]> {
  const { data, error } = await supabase.rpc("get_ranked_home_feed", {
    p_fan_id: input.fanId,
    p_limit: input.limit,
    p_cursor_score: input.cursor?.score ?? null,
    p_cursor_published_at: input.cursor?.publishedAt ?? null,
    p_cursor_id: input.cursor?.id ?? null,
  });

  if (error) {
    logger.error("feed.get_ranked_home_feed_failed", { error: error.message });
    throw new FeedUnavailableError();
  }

  return (data ?? []) as RankedFeedRow[];
}

async function buildFeedPage(
  supabase: SupabaseClient,
  fanId: string,
  cursorEncoded: string | null,
  limit: number,
): Promise<FeedPage> {
  const cursor = decodeFeedCursor(cursorEncoded);
  const rows = await fetchRankedFeedRows(supabase, {
    fanId,
    limit: limit + 1,
    cursor,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const posts = await enrichPosts(
    supabase,
    pageRows.map((r) => ({
      id: r.id,
      creator_id: r.creator_id,
      type: r.type,
      caption: r.caption,
      content_warning: r.content_warning,
      visibility: r.visibility,
      plan_id: r.plan_id,
      ppv_price_kobo: r.ppv_price_kobo,
      status: r.status,
      moderation_status: r.moderation_status,
      published_at: r.published_at,
      scheduled_publish_at: r.scheduled_publish_at,
      stats_cache: r.stats_cache,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    fanId,
  );

  let mergedPosts = posts;
  if (!cursorEncoded) {
    const pendingOwn = await listCreatorOwnPendingFeedPosts(supabase, fanId);
    if (pendingOwn.length > 0) {
      const seen = new Set(posts.map((p) => p.id));
      mergedPosts = [
        ...pendingOwn.filter((p) => !seen.has(p.id)),
        ...posts,
      ];
    }
  }

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeFeedCursor(
          cursorFromRow({
            feed_score: last.feed_score,
            published_at: last.published_at,
            id: last.id,
          }),
        )
      : null;

  return { posts: mergedPosts, nextCursor, hasMore };
}

async function listCreatorOwnPendingFeedPosts(
  supabase: SupabaseClient,
  creatorId: string,
  limit = 10,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("status", "published")
    .eq("moderation_status", "pending")
    .eq("is_story", false)
    .is("removed_at", null)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  return enrichPosts(supabase, data, creatorId);
}

export async function getHomeFeedPage(
  supabase: SupabaseClient,
  fanId: string,
  options?: {
    cursor?: string | null;
    limit?: number;
    skipCache?: boolean;
  },
): Promise<FeedPage> {
  const limit = Math.min(
    options?.limit ?? FEED_PAGE_SIZE,
    FEED_MAX_PAGE_SIZE,
  );
  const cursorKey = options?.cursor ?? "first";

  if (options?.skipCache) {
    return buildFeedPage(supabase, fanId, options?.cursor ?? null, limit);
  }

  const cached = unstable_cache(
    () => buildFeedPage(supabase, fanId, options?.cursor ?? null, limit),
    ["home-feed", fanId, cursorKey, String(limit)],
    {
      revalidate: FEED_CACHE_SECONDS,
      tags: [`feed:user:${fanId}`],
    },
  );

  return cached();
}

export function feedCacheTag(userId: string): string {
  return `feed:user:${userId}`;
}
