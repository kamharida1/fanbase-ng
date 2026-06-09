import { createHash } from "node:crypto";

import { checkRateLimit } from "@/lib/rate-limit";

// Simple URL regex — catches http(s) and bare domain-like patterns
const URL_RE = /https?:\/\/\S+|(?:^|\s)[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?/gi;

// Minimum message length that warrants a fingerprint check — very short messages
// (reactions, "ok", "👍") are too common to fingerprint meaningfully.
const MIN_FINGERPRINT_LEN = 20;

// How many times the same message body may be sent to different conversations
// in a rolling hour before we treat it as spam.
const SAME_BODY_HOURLY_CAP = 4;

export type SpamCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Checks whether a message body looks like spam.
 *
 * Two checks:
 * 1. URL density — more than 3 URLs in a single message is a red flag.
 * 2. Identical-body fingerprint — the same text sent to > SAME_BODY_HOURLY_CAP
 *    distinct conversations within an hour triggers a rate-limit.
 *
 * Both checks are skipped for empty/media-only messages.
 */
export async function checkMessageSpam(
  senderId: string,
  body: string | null | undefined,
): Promise<SpamCheckResult> {
  const text = body?.trim() ?? "";
  if (!text) return { ok: true };

  // ── 1. URL density ─────────────────────────────────────────────────────────
  const urlMatches = text.match(URL_RE) ?? [];
  if (urlMatches.length > 3) {
    return {
      ok: false,
      reason:
        "Your message contains too many links and was blocked as potential spam. Please send links one at a time.",
    };
  }

  // ── 2. Identical-body fingerprint rate limit ───────────────────────────────
  if (text.length >= MIN_FINGERPRINT_LEN) {
    const bodyHash = createHash("sha256")
      .update(text.toLowerCase())
      .digest("hex")
      .slice(0, 16);

    const rl = await checkRateLimit(
      `msgFingerprint:${senderId}:${bodyHash}`,
      { limit: SAME_BODY_HOURLY_CAP, windowSeconds: 3600 },
    );

    if (!rl.ok) {
      return {
        ok: false,
        reason:
          "You've sent this message too many times. Please vary your messages or wait before sending again.",
      };
    }
  }

  return { ok: true };
}
