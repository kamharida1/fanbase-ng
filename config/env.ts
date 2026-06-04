import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  MEDIA_WEBHOOK_SECRET: z.string().min(16).optional(),
  WALLET_ENCRYPTION_KEY: z.string().min(32).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

function parseEnv(): Env {
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY:
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    MEDIA_WEBHOOK_SECRET: process.env.MEDIA_WEBHOOK_SECRET,
    WALLET_ENCRYPTION_KEY: process.env.WALLET_ENCRYPTION_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
  });

  if (!parsed.success) {
    const message = parsed.error.flatten().fieldErrors;
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(message)}`,
    );
  }

  return parsed.data;
}

/** Server-only. Validates on first access. */
export function getEnv(): Env {
  if (cached) return cached;
  if (process.env.NODE_ENV === "test") {
    cached = {
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    } as Env;
    return cached;
  }
  cached = parseEnv();
  return cached;
}

const productionRequired = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  PAYSTACK_SECRET_KEY: z.string().min(1),
  MEDIA_WEBHOOK_SECRET: z.string().min(16),
  WALLET_ENCRYPTION_KEY: z.string().min(32),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z
    .string()
    .min(3, "R2 bucket name must be at least 3 characters")
    .max(63, "R2 bucket name must be at most 63 characters")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "R2 bucket name must be lowercase alphanumeric with hyphens, and start/end with a letter or number",
    ),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_STREAM_API_TOKEN: z.string().min(1),
  CLOUDFLARE_STREAM_CUSTOMER_CODE: z.string().min(1),
});

/** Called from instrumentation on server boot (Vercel production only). */
export function validateProductionEnv(): void {
  if (process.env.VERCEL_ENV !== "production") return;

  getEnv();

  const strict = productionRequired.safeParse(process.env);
  if (!strict.success) {
    const missing = Object.keys(strict.error.flatten().fieldErrors);
    throw new Error(
      `Production missing required env: ${missing.join(", ")}`,
    );
  }
}
