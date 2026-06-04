import { describe, expect, it } from "vitest";

import {
  cursorFromRow,
  decodeFeedCursor,
  encodeFeedCursor,
} from "@/lib/feed/cursor";

describe("feed cursor", () => {
  const row = {
    feed_score: 1200.5,
    published_at: "2026-01-15T10:00:00.000Z",
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  };

  it("round-trips cursor", () => {
    const cursor = cursorFromRow(row);
    const encoded = encodeFeedCursor(cursor);
    expect(decodeFeedCursor(encoded)).toEqual(cursor);
  });

  it("returns null for invalid cursor", () => {
    expect(decodeFeedCursor("not-base64!!!")).toBeNull();
    expect(decodeFeedCursor("")).toBeNull();
  });
});
