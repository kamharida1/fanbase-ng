import type { SupabaseClient } from "@supabase/supabase-js";

import { resolvePostMediaUrl } from "@/lib/media/resolve-url";
import { normalizeMediaUrl } from "@/lib/media/delivery-url";
import type {
  PollOption,
  PostAuthor,
  PostCommentRow,
  PostMediaRow,
  PostPoll,
  PostRow,
  PostStats,
  TrendingHashtag,
} from "@/types/posts";
import { normalizeHashtag } from "@/lib/posts/hashtags";

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
        avatar_url: normalizeMediaUrl(p.avatar_url),
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

async function loadPollsByPost(
  supabase: SupabaseClient,
  postIds: string[],
  viewerId: string | null,
): Promise<Map<string, PostPoll>> {
  const map = new Map<string, PostPoll>();
  if (postIds.length === 0) return map;

  const { data: polls } = await supabase
    .from("post_polls")
    .select("id, post_id, question, closes_at")
    .in("post_id", postIds);

  if (!polls || polls.length === 0) return map;

  const pollIds = polls.map((p) => p.id as string);

  const [{ data: options }, { data: results }, { data: myVotes }] = await Promise.all([
    supabase
      .from("poll_options")
      .select("id, poll_id, label, sort_order")
      .in("poll_id", pollIds)
      .order("sort_order", { ascending: true }),
    supabase.rpc("get_poll_results", { p_poll_ids: pollIds }),
    viewerId
      ? supabase
          .from("poll_votes")
          .select("poll_id, option_id")
          .eq("voter_id", viewerId)
          .in("poll_id", pollIds)
      : Promise.resolve({ data: [] as { poll_id: string; option_id: string }[] }),
  ]);

  const countByOption = new Map<string, number>();
  for (const row of (results ?? []) as { option_id: string; vote_count: number }[]) {
    countByOption.set(row.option_id, Number(row.vote_count));
  }

  const myVoteByPoll = new Map<string, string>();
  for (const vote of (myVotes ?? []) as { poll_id: string; option_id: string }[]) {
    myVoteByPoll.set(vote.poll_id, vote.option_id);
  }

  const optionsByPoll = new Map<string, PollOption[]>();
  for (const row of (options ?? []) as { id: string; poll_id: string; label: string; sort_order: number }[]) {
    const list = optionsByPoll.get(row.poll_id) ?? [];
    list.push({
      id: row.id,
      label: row.label,
      sort_order: row.sort_order,
      vote_count: countByOption.get(row.id) ?? 0,
    });
    optionsByPoll.set(row.poll_id, list);
  }

  for (const poll of polls) {
    const pollId = poll.id as string;
    const options = optionsByPoll.get(pollId) ?? [];
    map.set(poll.post_id as string, {
      id: pollId,
      post_id: poll.post_id as string,
      question: poll.question as string,
      closes_at: poll.closes_at as string | null,
      options,
      total_votes: options.reduce((sum, o) => sum + o.vote_count, 0),
      my_vote_option_id: myVoteByPoll.get(pollId) ?? null,
    });
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

  const [authors, canViewMap, mediaByPost, pollsByPost, likedSet] = await Promise.all([
    loadAuthors(supabase, creatorIds),
    loadCanViewMap(supabase, viewerId, postIds),
    loadPostMediaByPost(supabase, postIds),
    loadPollsByPost(supabase, postIds, viewerId),
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
      content_warning: post.content_warning as string | null,
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
      is_pinned: Boolean(post.is_pinned),
      poll: pollsByPost.get(id) ?? null,
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
  limit = 200,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("creator_id", creatorId)
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(limit);

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
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return enrichPosts(supabase, data, viewerId);
}

export async function searchPosts(
  supabase: SupabaseClient,
  input: {
    query?: string;
    hashtag?: string;
    viewerId: string | null;
    limit?: number;
  },
): Promise<PostRow[]> {
  const trimmedQuery = input.query?.trim();
  const hashtag = input.hashtag ? normalizeHashtag(input.hashtag) : undefined;
  if (!trimmedQuery && !hashtag) return [];

  let q = supabase
    .from("posts")
    .select("*")
    .eq("status", "published")
    .is("removed_at", null)
    .eq("moderation_status", "approved")
    .order("published_at", { ascending: false })
    .limit(input.limit ?? 20);

  if (trimmedQuery) {
    q = q.textSearch("search_vector", trimmedQuery, {
      type: "websearch",
      config: "simple",
    });
  }
  if (hashtag) {
    q = q.contains("hashtags", [hashtag]);
  }

  const { data, error } = await q;
  if (error || !data) return [];

  return enrichPosts(supabase, data, input.viewerId);
}

export async function listTrendingPosts(
  supabase: SupabaseClient,
  viewerId: string | null,
  limit = 20,
): Promise<PostRow[]> {
  const { data, error } = await supabase.rpc("get_trending_posts", {
    p_fan_id: viewerId,
    p_limit: limit,
  });

  if (error || !data) return [];

  return enrichPosts(supabase, data as Record<string, unknown>[], viewerId);
}

export async function listTrendingHashtags(
  supabase: SupabaseClient,
  limit = 10,
): Promise<TrendingHashtag[]> {
  const { data, error } = await supabase.rpc("get_trending_hashtags", {
    p_limit: limit,
  });

  if (error || !data) return [];

  return (data as { hashtag: string; post_count: number }[]).map((row) => ({
    hashtag: row.hashtag,
    post_count: Number(row.post_count),
  }));
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
  { includeHidden = false }: { includeHidden?: boolean } = {},
): Promise<PostCommentRow[]> {
  let query = supabase
    .from("post_comments")
    .select("id, post_id, author_id, body, parent_id, created_at, is_pinned, is_hidden_by_creator")
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: true });

  if (!includeHidden) {
    query = query.eq("is_hidden_by_creator", false);
  }

  const { data, error } = await query;

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
