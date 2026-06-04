# Fanbase NG roadmap

The web app is built in **increments** (see `docs/increments/`). This file tracks **overall status**; each increment doc has setup and exit criteria.

---

## Current status (June 2026)

**Web (Next.js)** — feature-complete MVP, hardened for beta/production.

| Area | Status |
|------|--------|
| Auth, RBAC, sessions | Done — [02-auth](increments/02-auth.md) |
| Creator profiles & discovery | Done — [03-creator-profiles](increments/03-creator-profiles.md) |
| Subscriptions & Paystack | Done — [05-subscriptions](increments/05-subscriptions.md), [05-paystack](increments/05-paystack.md) |
| Creator wallets & payouts | Done — [06-creator-wallets](increments/06-creator-wallets.md) |
| Messaging | Done — [07-messaging](increments/07-messaging.md) |
| Posts & media (R2/Stream) | Done — [08-creator-posts](increments/08-creator-posts.md), [09-secure-media](increments/09-secure-media.md) |
| Home feed ranking | Done — [10-home-feed](increments/10-home-feed.md) |
| Notifications | Done — [11-notifications](increments/11-notifications.md) |
| Admin dashboard | Done — [12-admin-dashboard](increments/12-admin-dashboard.md) |
| Production Phase 1 | Done — [13-production-phase1](increments/13-production-phase1.md) |
| Security hardening | Done — RLS, API origin, cron auth, payment validation |
| Tests & CI | Vitest + Playwright, `.github/workflows/ci-cd.yml` |
| Deployment plan | [deployment/production-plan.md](deployment/production-plan.md) |
| Error tracking | Sentry (`@sentry/nextjs`) when `SENTRY_DSN` is set |

**Database:** 38 migrations in `supabase/migrations/` — run `supabase db push` per environment.

**Mobile (Expo):** Not in this repo. See [docs/mobile.md](mobile.md).

---

## Launch checklist

1. `supabase db push` on staging/production
2. Vercel production env (see `.env.production.example`)
3. Paystack live webhooks → `/api/v1/webhooks/paystack`
4. Upstash for rate limits
5. `SENTRY_DSN` + optional `SENTRY_ORG` / `SENTRY_PROJECT` for source maps
6. Uptime on `/api/health` and `/api/ready`
7. Smoke: signup → subscribe (test) → feed → creator post

---

## Phase 2 backlog

| Item | Notes |
|------|--------|
| Paystack transfer on payout approve | Admin approve may be DB-only today |
| Creator list caching | Readiness report |
| CSP enforce (not report-only) | Security |
| Staging Supabase in CI smoke | Optional job |
| Discovery search & analytics | Product |
| Compliance exports | Audit increment extension |

---

## Increment index

| # | Doc |
|---|-----|
| 2 | [02-auth.md](increments/02-auth.md) |
| 3 | [03-creator-profiles.md](increments/03-creator-profiles.md) |
| 5 | [05-subscriptions.md](increments/05-subscriptions.md) |
| 5b | [05-paystack.md](increments/05-paystack.md) |
| 6 | [06-creator-wallets.md](increments/06-creator-wallets.md) |
| 7 | [07-messaging.md](increments/07-messaging.md) |
| 8 | [08-creator-posts.md](increments/08-creator-posts.md) |
| 9 | [09-secure-media.md](increments/09-secure-media.md) |
| 10 | [10-home-feed.md](increments/10-home-feed.md) |
| 11 | [11-notifications.md](increments/11-notifications.md) |
| 12 | [12-admin-dashboard.md](increments/12-admin-dashboard.md) |
| 13 | [13-production-phase1.md](increments/13-production-phase1.md) |

---

## Rules

1. One increment per PR when possible.
2. Migrations only when the increment needs them.
3. Paystack test keys before live mode.
4. Ship empty states — valid UX.
