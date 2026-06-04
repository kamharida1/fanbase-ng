import { describe, expect, it, vi } from "vitest";

import { getHomeFeedPage } from "@/lib/feed/queries";

vi.mock("@/lib/posts/queries", () => ({
  enrichPosts: vi.fn().mockResolvedValue([
    {
      id: "post-1",
      creator_id: "c1",
      type: "text",
      caption: null,
      visibility: "public",
      plan_id: null,
      ppv_price_kobo: null,
      status: "published",
      moderation_status: "approved",
      published_at: "2026-01-01T00:00:00Z",
      scheduled_publish_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      stats_cache: { likes: 0, comments: 0 },
      can_view_full: true,
      liked_by_me: false,
      like_count: 0,
      comment_count: 0,
      media: [],
    },
  ]),
}));

describe("getHomeFeedPage success", () => {
  it("returns page with cursor", async () => {
    const postId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: postId,
            creator_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            type: "text",
            caption: null,
            visibility: "public",
            plan_id: null,
            ppv_price_kobo: null,
            status: "published",
            moderation_status: "approved",
            published_at: "2026-01-01T00:00:00Z",
            scheduled_publish_at: null,
            stats_cache: {},
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            feed_score: 100,
          },
        ],
        error: null,
      }),
    };

    const page = await getHomeFeedPage(supabase as never, "fan", {
      skipCache: true,
      limit: 5,
    });

    expect(page.posts).toHaveLength(1);
    expect(page.hasMore).toBe(false);
  });
});
