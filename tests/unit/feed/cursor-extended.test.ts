import { describe, expect, it } from "vitest";

import { decodeFeedCursor } from "@/lib/feed/cursor";

describe("decodeFeedCursor invalid shape", () => {
  it("rejects cursor missing fields", () => {
    const bad = Buffer.from(JSON.stringify({ score: 1 }), "utf8").toString(
      "base64url",
    );
    expect(decodeFeedCursor(bad)).toBeNull();
  });
});
