import type { SupabaseClient } from "@supabase/supabase-js";

export type StoryItem = {
  id: string;
  creator_id: string;
  type: string;
  caption: string | null;
  media_url: string | null;
  expires_at: string;
  created_at: string;
  viewed: boolean;
};

export type StoryGroup = {
  creator: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  stories: StoryItem[];
  hasUnviewed: boolean;
};

/** Stories from creators the viewer subscribes to + all public stories. */
export async function getStoryGroups(
  supabase: SupabaseClient,
  viewerId: string | null,
): Promise<StoryGroup[]> {
  const now = new Date().toISOString();

  // Public stories + stories from subscribed creators
  let query = supabase
    .from("posts")
    .select(
      `id, creator_id, type, caption, expires_at, created_at,
       visibility,
       post_media!left (r2_key, stream_uid, media_type, sort_order),
       profiles!inner (id, username, display_name, avatar_url)`,
    )
    .eq("is_story", true)
    .eq("status", "published")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(100);

  if (viewerId) {
    // Stories from subscribed creators OR public stories
    query = query.or(
      `visibility.eq.public,creator_id.in.(${viewerId})`,
    );
  } else {
    query = query.eq("visibility", "public");
  }

  const { data: posts, error } = await query;
  if (error || !posts?.length) return [];

  // Get viewed status for this viewer
  const storyIds = posts.map((p) => p.id);
  const viewedSet = new Set<string>();

  if (viewerId && storyIds.length > 0) {
    const { data: views } = await supabase
      .from("story_views")
      .select("story_id")
      .in("story_id", storyIds)
      .eq("viewer_id", viewerId);
    (views ?? []).forEach((v) => viewedSet.add(v.story_id));
  }

  // Also check subscription for subscriber-only stories
  const subscribedCreators = new Set<string>();
  if (viewerId) {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("creator_id")
      .eq("fan_id", viewerId)
      .in("status", ["active", "trialing"]);
    (subs ?? []).forEach((s) => subscribedCreators.add(s.creator_id));
  }

  // Group by creator
  const groupMap = new Map<string, StoryGroup>();

  for (const post of posts) {
    // Access control: skip subscriber-only stories if not subscribed
    if (
      post.visibility === "subscribers" &&
      viewerId !== post.creator_id &&
      !subscribedCreators.has(post.creator_id)
    ) {
      continue;
    }

    const profile = Array.isArray(post.profiles)
      ? post.profiles[0]
      : post.profiles;
    if (!profile) continue;

    const media = Array.isArray(post.post_media) ? post.post_media[0] : null;
    const mediaUrl =
      media?.r2_key
        ? `/api/v1/media/delivery?objectKey=${encodeURIComponent(media.r2_key)}`
        : null;

    const story: StoryItem = {
      id: post.id,
      creator_id: post.creator_id,
      type: post.type,
      caption: post.caption,
      media_url: mediaUrl,
      expires_at: post.expires_at,
      created_at: post.created_at,
      viewed: viewedSet.has(post.id),
    };

    if (!groupMap.has(post.creator_id)) {
      groupMap.set(post.creator_id, {
        creator: {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
        },
        stories: [],
        hasUnviewed: false,
      });
    }

    const group = groupMap.get(post.creator_id)!;
    group.stories.push(story);
    if (!story.viewed) group.hasUnviewed = true;
  }

  // Sort: unviewed groups first
  return [...groupMap.values()].sort(
    (a, b) => Number(b.hasUnviewed) - Number(a.hasUnviewed),
  );
}
