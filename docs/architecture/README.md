# Fanbase NG — Architecture

This project implements the production architecture for a Nigerian creator subscription platform.

## Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Shadcn UI
- **Backend:** Next.js API routes, Supabase (Postgres, Auth, Realtime)
- **Payments:** Paystack (NGN)
- **Media:** Cloudflare R2, Cloudflare Stream
- **Hosting:** Vercel

## Route groups

| Group | Path prefix | Purpose |
|-------|-------------|---------|
| `(marketing)` | `/`, `/creators`, `/legal` | Public site |
| `(auth)` | `/login`, `/signup`, `/verify`, `/callback` | Authentication |
| `(fan)` | `/feed`, `/discover`, `/subscriptions`, `/messages`, `/settings` | Subscriber app |
| `(creator)` | `/creator/*` | Creator studio |
| `(admin)` | `/admin/*` | Internal operations |

## Incremental development

**Use [ROADMAP.md](../ROADMAP.md)** — build in order (auth → creator profile → posts → Paystack → earnings). Do not implement the full architecture at once.

Current scaffold is intentionally ahead of implementation; treat unused routes as placeholders.

## Database

Initial migration: `supabase/migrations/20250602000001_initial_schema.sql`

Full schema (posts, messages, ledger, withdrawals, moderation) ships in follow-up migrations.
