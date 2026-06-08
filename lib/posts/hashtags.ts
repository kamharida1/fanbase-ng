const HASHTAG_PATTERN = /#([a-z0-9_]{2,50})/gi;
const MAX_HASHTAGS_PER_POST = 10;

export function extractHashtags(caption: string | null | undefined): string[] {
  if (!caption) return [];

  const seen = new Set<string>();
  for (const match of caption.matchAll(HASHTAG_PATTERN)) {
    const tag = match[1].toLowerCase();
    seen.add(tag);
    if (seen.size >= MAX_HASHTAGS_PER_POST) break;
  }

  return Array.from(seen);
}

export function normalizeHashtag(input: string): string {
  return input.trim().replace(/^#/, "").toLowerCase();
}
