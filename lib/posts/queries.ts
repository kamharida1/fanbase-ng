import type { SupabaseClient } from "@supabase/supabase-js";

import { resolvePostMediaUrl } from "@/lib/media/resolve-url";
import type {
  PostAuthor,
  PostCommentRow,
  PostMediaRow,
  PostRow,
  PostStats,
} from "@/types/posts";

type PostMediaRecord = {
  id: string;
  post_id: string;
  media_type: string;
  r2_key: string | null;
  stream_uid: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  byte_size: number | null;
  sort_order: number;
  processing_status: string;
  media_upload_id: string | null;
};

async function loadAuthors(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, PostAuthor>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", unique);

  return new Map(
    (data ?? []).map((p) => [
      p.id,
      {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      },
    ]),
  );
}

async function loadCanViewMap(
  supabase: SupabaseClient,
  viewerId: string | null,
  postIds: string[],
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (postIds.length === 0) return map;

  const { data, error } = await supabase.rpc("can_view_posts", {
    p_user_id: viewerId,
    p_post_ids: postIds,
  });

  if (error) {
    for (const id of postIds) {
      const { data: single } = await supabase.rpc("can_view_post", {
        p_user_id: viewerId,
        p_post_id: id,
      });
      map.set(id, Boolean(single));
    }
    return map;
  }

  for (const row of data ?? []) {
    const r = row as { post_id: string; can_view: boolean };
    map.set(r.post_id, Boolean(r.can_view));
  }

  for (const id of postIds) {
    if (!map.has(id)) map.set(id, false);
  }

  return map;
}

async function loadPostMediaByPost(
  supabase: SupabaseClient,
  postIds: string[],
): Promise<Map<string, PostMediaRecord[]>> {
  const map = new Map<string, PostMediaRecord[]>();
  if (postIds.length === 0) return map;

  const { data } = await supabase
    .from("post_media")
    .select(
      "id, post_id, media_type, r2_key, stream_uid, thumbnail_url, duration_seconds, byte_size, sort_order, processing_status, media_upload_id",
    )
    .in("post_id", postIds)
    .order("sort_order", { ascending: true });

  for (const row of data ?? []) {
    const m = row as PostMediaRecord;
    const list = map.get(m.post_id) ?? [];
    list.push(m);
    map.set(m.post_id, list);
  }

  return map;
}

async function resolveMediaRows(
  supabase: SupabaseClient,
  items: PostMediaRecord[],
  canViewFull: boolean,
  viewerId: string | null,
): Promise<PostMediaRow[]> {
  return Promise.all(
    items.map(async (m) => {
      const url = await resolvePostMediaUrl(supabase, {
        viewerId,
        canViewFull,
        mediaUploadId: m.media_upload_id,
        r2Key: m.r2_key,
        streamUid: m.stream_uid,
        thumbnailUrl: m.thumbnail_url,
      });
      return {
        ...m,
        media_type: m.media_type as PostMediaRow["media_type"],
        url,
      };
    }),
  );
}

function parseStats(raw: unknown): PostStats {
  if (raw && typeof raw === "object") {
    const s = raw as PostStats;
    return {
      likes: typeof s.likes === "number" ? s.likes : 0,
      comments: typeof s.comments === "number" ? s.comments : 0,
    };
  }
  return { likes: 0, comments: 0 };
}

export async function enrichPosts(
  supabase: SupabaseClient,
  posts: Record<string, unknown>[],
  viewerId: string | null,
): Promise<PostRow[]> {
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id as string);
  const creatorIds = posts.map((p) => p.creator_id as string);

  const [authors, canViewMap, mediaByPost, likedSet] = await Promise.all([
    loadAuthors(supabase, creatorIds),
    loadCanViewMap(supabase, viewerId, postIds),
    loadPostMediaByPost(supabase, postIds),
    (async () => {
      const set = new Set<string>();
      if (!viewerId) return set;
      const { data: likes } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("fan_id", viewerId)
        .in("post_id", postIds);
      for (const like of likes ?? []) {
        set.add(like.post_id);
      }
      return set;
    })(),
  ]);

  const resolvedMedia = new Map<string, PostMediaRow[]>();
  await Promise.all(
    postIds.map(async (postId) => {
      const canViewFull = canViewMap.get(postId) ?? false;
      const items = mediaByPost.get(postId) ?? [];
      resolvedMedia.set(
        postId,
        await resolveMediaRows(supabase, items, canViewFull, viewerId),
      );
    }),
  );

  return posts.map((post) => {
    const id = post.id as string;
    const creatorId = post.creator_id as string;
    const canViewFull = canViewMap.get(id) ?? false;
    const stats = parseStats(post.stats_cache);

    return {
      id,
      creator_id: creatorId,
      type: post.type as PostRow["type"],
      caption: post.caption as string | null,
      visibility: post.visibility as PostRow["visibility"],
      plan_id: post.plan_id as string | null,
      ppv_price_kobo: post.ppv_price_kobo as number | null,
      status: post.status as PostRow["status"],
      moderation_status: post.moderation_status as string,
      published_at: post.published_at as string | null,
      scheduled_publish_at: post.scheduled_publish_at as string | null,
      created_at: post.created_at as string,
      updated_at: post.updated_at as string,
      stats_cache: stats,
      author: authors.get(creatorId),
      media: resolvedMedia.get(id) ?? [],
      liked_by_me: likedSet.has(id),
      can_view_full: canViewFull,
      like_count: stats.likes ?? 0,
      comment_count: stats.comments ?? 0,
    };
  });
}

export async function enrichPost(
  supabase: SupabaseClient,
  post: Record<string, unknown>,
  viewerId: string | null,
): Promise<PostRow> {
  const [row] = await enrichPosts(supabase, [post], viewerId);
  return row;
}

export async function listCreatorPosts(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("creator_id", creatorId)
    .neq("status", "removed")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return enrichPosts(supabase, data, creatorId);
}

export async function listCreatorPublishedPosts(
  supabase: SupabaseClient,
  creatorId: string,
  viewerId: string | null,
  limit = 20,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("status", "published")
    .is("removed_at", null)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return enrichPosts(supabase, data, viewerId);
}

/** @deprecated Use getHomeFeedPage from lib/feed/queries */
export async function listFeedPosts(
  supabase: SupabaseClient,
  viewerId: string | null,
  limit = 30,
): Promise<PostRow[]> {
  if (!viewerId) return [];
  const { getHomeFeedPage } = await import("@/lib/feed/queries");
  const page = await getHomeFeedPage(supabase, viewerId, {
    limit,
    skipCache: true,
  });
  return page.posts;
}

export async function getPostById(
  supabase: SupabaseClient,
  postId: string,
  viewerId: string | null,
): Promise<PostRow | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (error || !data) return null;
  return enrichPost(supabase, data, viewerId);
}

export async function listPostComments(
  supabase: SupabaseClient,
  postId: string,
): Promise<PostCommentRow[]> {
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, author_id, body, parent_id, created_at, is_pinned")
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .eq("is_hidden_by_creator", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const authors = await loadAuthors(
    supabase,
    data.map((c) => c.author_id),
  );

  return data.map((c) => ({
    ...c,
    author: authors.get(c.author_id),
  }));
}
