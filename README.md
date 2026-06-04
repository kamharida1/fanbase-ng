# Fanbase NG

Nigerian creator subscription platform — support creators through tiers, PPV, tips, and messaging.

## Stack

Next.js 15 · TypeScript · Supabase · Tailwind CSS · Shadcn UI · Paystack · Cloudflare R2/Stream · Vercel

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in Supabase and Paystack keys from your dashboards.

### 3. Database

Install [Supabase CLI](https://supabase.com/docs/guides/cli), link your project, then:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Or run the SQL in `supabase/migrations/20250602000001_initial_schema.sql` from the Supabase SQL editor.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Auth setup: [docs/auth.md](docs/auth.md)

### 5. Shadcn components

`components.json` is configured. Add components when ready:

```bash
npx shadcn@latest add button card input label form
```

## Incremental development

**Start here:** [docs/ROADMAP.md](docs/ROADMAP.md) — phased plan (auth first, payments later).

Route groups for creator, admin, and fan features exist as placeholders; implement only what the current increment needs.

## Project structure

See [docs/architecture/README.md](docs/architecture/README.md) for route groups and stack overview.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest (unit + integration) |
| `npm run test:coverage` | Vitest with ≥80% coverage (scoped modules) |
| `npm run test:e2e` | Playwright E2E |

See [docs/testing.md](docs/testing.md).

Production deployment: [docs/deployment/production-plan.md](docs/deployment/production-plan.md).

Mobile (Expo) lives in a separate repo — see [docs/mobile.md](docs/mobile.md).

## License

Private — all rights reserved.
