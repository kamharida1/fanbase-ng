# Production Phase 1

## Added

- `GET /api/health`, `GET /api/ready`
- `instrumentation.ts` + `validateProductionEnv()` (Vercel production)
- Structured JSON logging (`lib/logger.ts`)
- Request ID header (`x-request-id`) in middleware
- Rate limiting (`lib/rate-limit.ts`) — Upstash when configured, in-memory fallback
- Feed: batch `can_view_posts` RPC + batched `post_media` load
- `app/error.tsx`, `app/(fan)/feed/error.tsx`
- Security headers + image config in `next.config.ts`
- Migration `20250615000001_can_view_posts_batch.sql`

## Deploy

1. `supabase db push`
2. Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` on Vercel
3. Ensure production env: `CRON_SECRET`, `MEDIA_WEBHOOK_SECRET`, `WALLET_ENCRYPTION_KEY` (32+ chars)
4. Point uptime monitor at `/api/health` and `/api/ready`

## Optional

- `SENTRY_DSN` — add `@sentry/nextjs` and init in `instrumentation.ts`
