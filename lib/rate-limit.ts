import { logger } from "@/lib/logger";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

type LimitConfig = {
  limit: number;
  windowSeconds: number;
};

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, config: LimitConfig): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(key, {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    });
    return { ok: true };
  }

  if (bucket.count >= config.limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000),
      ),
    };
  }

  bucket.count += 1;
  return { ok: true };
}

type UpstashRatelimit = {
  limit: (key: string) => Promise<{
    success: boolean;
    reset: number;
  }>;
};

const upstashLimiters = new Map<string, UpstashRatelimit | null>();
let upstashUnavailable = false;

function limiterKey(config: LimitConfig): string {
  return `${config.limit}:${config.windowSeconds}`;
}

async function getUpstashLimiter(
  config: LimitConfig,
): Promise<UpstashRatelimit | null> {
  const key = limiterKey(config);
  if (upstashLimiters.has(key)) {
    return upstashLimiters.get(key) ?? null;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!upstashUnavailable && process.env.NODE_ENV === "production") {
      upstashUnavailable = true;
      logger.warn("rate_limit.memory_fallback", {
        hint: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
      });
    }
    upstashLimiters.set(key, null);
    return null;
  }

  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");

    const limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(
        config.limit,
        `${config.windowSeconds} s`,
      ),
    }) as UpstashRatelimit;
    upstashLimiters.set(key, limiter);
    return limiter;
  } catch (err) {
    logger.error("rate_limit.upstash_init_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    upstashLimiters.set(key, null);
    return null;
  }
}

export async function checkRateLimit(
  key: string,
  config: LimitConfig,
): Promise<RateLimitResult> {
  const limiter = await getUpstashLimiter(config);

  if (!limiter) {
    return memoryLimit(key, config);
  }

  const { success, reset } = await limiter.limit(key);
  if (success) return { ok: true };

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((reset - Date.now()) / 1000),
  );
  return { ok: false, retryAfterSeconds };
}

export const RATE_LIMITS = {
  feedFresh: { limit: 5, windowSeconds: 60 },
  mediaPresign: { limit: 30, windowSeconds: 60 },
  mediaDelivery: { limit: 120, windowSeconds: 60 },
  paymentVerify: { limit: 10, windowSeconds: 60 },
  creatorsPublic: { limit: 60, windowSeconds: 60 },
  // Auth: generous limits so real users never get blocked, while still
  // capping automated credential stuffing / signup spam.
  authLogin: { limit: 30, windowSeconds: 60 },
  authSignup: { limit: 15, windowSeconds: 60 },
  // Paystack webhook: protect against flood before HMAC check
  paystackWebhook: { limit: 60, windowSeconds: 60 },
  // Messaging: per-user hourly caps (new accounts get a tighter cap applied in code)
  messageSend: { limit: 60, windowSeconds: 3600 },
  messageSendNewAccount: { limit: 10, windowSeconds: 3600 },
  // Post creation: prevent content flooding
  postCreate: { limit: 20, windowSeconds: 3600 },
  postCreateNewAccount: { limit: 3, windowSeconds: 3600 },
  // Conversation initiation: prevent fan from spamming many creators
  conversationStart: { limit: 5, windowSeconds: 3600 },
  conversationStartNewAccount: { limit: 2, windowSeconds: 3600 },
} as const;
