import { describe, expect, it } from "vitest";

import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

describe("checkRateLimit (memory fallback)", () => {
  it("allows requests under limit", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const config = { limit: 3, windowSeconds: 60 };
    expect(await checkRateLimit(key, config)).toEqual({ ok: true });
    expect(await checkRateLimit(key, config)).toEqual({ ok: true });
  });

  it("blocks after limit exceeded", async () => {
    const key = `test:block:${crypto.randomUUID()}`;
    const config = { limit: 2, windowSeconds: 60 };
    await checkRateLimit(key, config);
    await checkRateLimit(key, config);
    const third = await checkRateLimit(key, config);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});

describe("RATE_LIMITS", () => {
  it("defines expected keys", () => {
    expect(RATE_LIMITS.feedFresh.limit).toBe(5);
    expect(RATE_LIMITS.mediaPresign.limit).toBe(30);
  });
});
