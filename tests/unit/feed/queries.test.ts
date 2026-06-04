import { describe, expect, it, vi } from "vitest";

import { FeedUnavailableError } from "@/lib/feed/errors";
import { feedCacheTag, getHomeFeedPage } from "@/lib/feed/queries";

describe("feedCacheTag", () => {
  it("namespaces by user", () => {
    expect(feedCacheTag("user-1")).toBe("feed:user:user-1");
  });
});

describe("getHomeFeedPage", () => {
  it("throws when ranked feed rpc fails", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "function not found" },
      }),
      from: vi.fn(),
    };

    await expect(
      getHomeFeedPage(supabase as never, "fan-id", { skipCache: true, limit: 5 }),
    ).rejects.toBeInstanceOf(FeedUnavailableError);
  });
});
