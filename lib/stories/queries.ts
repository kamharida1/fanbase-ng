import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildMediaDeliveryProxyUrl,
  normalizeMediaUrl,
} from "@/lib/media/delivery-url";

export type StoryViewer = {
  viewer_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  viewed_at: string;
};

export type StoryAnalyticsRow = {
  id: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  view_count: number;
  viewers: StoryViewer[];
};

/**
 * Returns the creator's recent stories (last 20) with per-story view counts
 * and the list of viewers (up to 50 per story).
 */
export async function getStoryAnalytics(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<StoryAnalyticsRow[]> {
  const now = new Date().toISOString();

  // Fetch recent stories (active + expired within last 7 days)
  const since = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const { data: stories, error } = await supabase
    .from("posts")
    .select("id, caption, created_at, expires_at")
    .eq("creator_id", creatorId)
    .eq("is_story", true)
    .eq("status", "published")
    .gte("expires_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !stories?.length) return [];

  const storyIds = stories.map((s) => s.id);

  // Fetch all views for these stories with viewer profiles in one query
  const { data: views } = await supabase
    .from("story_views")
    .select("story_id, viewer_id, viewed_at, profiles!inner(username, display_name, avatar_url)")
    .in("story_id", storyIds)
    .order("viewed_at", { ascending: false });

  // Group views by story_id
  const viewsByStory = new Map<string, StoryViewer[]>();
  for (const v of views ?? []) {
    const profile = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles;
    if (!profile) continue;
    const list = viewsByStory.get(v.story_id) ?? [];
    if (list.length < 50) {
      list.push({
        viewer_id: v.viewer_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        viewed_at: v.viewed_at,
      });
    }
    viewsByStory.set(v.story_id, list);
  }

  return stories.map((s) => {
    const viewers = viewsByStory.get(s.id) ?? [];
    return {
      id: s.id,
      caption: s.caption,
      created_at: s.created_at,
      expires_at: s.expires_at,
      is_active: s.expires_at > now,
      view_count: viewers.length,
      viewers,
    };
  });
}

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
       post_media!left (r2_key, stream_uid, media_type, sort_order, media_upload_id),
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
    const mediaUrl = media
      ? buildMediaDeliveryProxyUrl({
          uploadId: media.media_upload_id,
          streamUid: media.stream_uid,
          objectKey: media.r2_key,
        })
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
          avatar_url: normalizeMediaUrl(profile.avatar_url),
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
