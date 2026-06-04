import { beforeEach, describe, expect, it, vi } from "vitest";

describe("checkRateLimit with Upstash", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("uses Upstash when configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    vi.doMock("@upstash/ratelimit", () => ({
      Ratelimit: class {
        constructor() {}
        limit = vi.fn().mockResolvedValue({
          success: true,
          reset: Date.now() + 60_000,
        });
      },
      slidingWindow: vi.fn(),
    }));

    vi.doMock("@upstash/redis", () => ({
      Redis: { fromEnv: vi.fn() },
    }));

    const { checkRateLimit } = await import("@/lib/rate-limit");
    const result = await checkRateLimit("upstash:key", {
      limit: 5,
      windowSeconds: 60,
    });
    expect(result.ok).toBe(true);
  });
});
