import { describe, expect, it } from "vitest";

import { getLockedPostMessage, getPostVisibilityMeta } from "@/lib/posts/visibility";
import type { PostRow } from "@/types/posts";

const basePost: PostRow = {
  id: "p1",
  creator_id: "c1",
  type: "image",
  caption: null,
  content_warning: null,
  visibility: "subscribers",
  plan_id: null,
  ppv_price_kobo: null,
  status: "published",
  moderation_status: "approved",
  published_at: null,
  scheduled_publish_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  stats_cache: {},
  can_view_full: false,
  author: {
    id: "c1",
    username: "ada",
    display_name: "Ada",
    avatar_url: null,
  },
};

describe("getPostVisibilityMeta", () => {
  it("labels subscriber-only posts clearly", () => {
    expect(getPostVisibilityMeta("subscribers").label).toBe("Subscribers only");
  });
});

describe("getLockedPostMessage", () => {
  it("explains subscriber-only locks", () => {
    const message = getLockedPostMessage(basePost);
    expect(message.title).toBe("Subscribers only");
    expect(message.detail).toContain("@ada");
  });

  it("shows PPV pricing in the title", () => {
    const message = getLockedPostMessage({
      ...basePost,
      visibility: "ppv",
      ppv_price_kobo: 250_000,
    });
    expect(message.title).toContain("₦");
  });
});
