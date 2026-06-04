import type { FeedCursor } from "@/types/feed";

export function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeFeedCursor(encoded: string | null | undefined): FeedCursor | null {
  if (!encoded?.trim()) return null;

  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as FeedCursor;

    if (
      typeof parsed.score !== "number" ||
      typeof parsed.publishedAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function cursorFromRow(input: {
  feed_score: number;
  published_at: string;
  id: string;
}): FeedCursor {
  return {
    score: input.feed_score,
    publishedAt: input.published_at,
    id: input.id,
  };
}
