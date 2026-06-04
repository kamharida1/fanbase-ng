import { describe, expect, it } from "vitest";

import { FeedUnavailableError } from "@/lib/feed/errors";

describe("FeedUnavailableError", () => {
  it("has stable code", () => {
    const err = new FeedUnavailableError();
    expect(err.code).toBe("feed_unavailable");
    expect(err.message).toContain("unavailable");
  });
});
