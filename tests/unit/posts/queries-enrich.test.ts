import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/media/resolve-url", () => ({
  resolvePostMediaUrl: vi.fn().mockResolvedValue(null),
}));

import { enrichPosts } from "@/lib/posts/queries";

describe("enrichPosts", () => {
  it("returns enriched posts with batched queries", async () => {
    const postId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const creatorId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: creatorId,
                    username: "creator",
                    display_name: "Creator",
                    avatar_url: null,
                  },
                ],
              }),
            }),
          };
        }
        if (table === "post_likes") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          };
        }
        if (table === "post_media") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          };
        }
        return {};
      }),
      rpc: vi.fn((fn: string) => {
        if (fn === "can_view_posts") {
          return Promise.resolve({
            data: [{ post_id: postId, can_view: true }],
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    const rows = await enrichPosts(
      supabase as never,
      [
        {
          id: postId,
          creator_id: creatorId,
          type: "text",
          caption: "Hi",
          visibility: "public",
          plan_id: null,
          ppv_price_kobo: null,
          status: "published",
          moderation_status: "approved",
          published_at: new Date().toISOString(),
          scheduled_publish_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          stats_cache: { likes: 1, comments: 0 },
        },
      ],
      "fan-id",
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].can_view_full).toBe(true);
    expect(rows[0].author?.username).toBe("creator");
  });
});
