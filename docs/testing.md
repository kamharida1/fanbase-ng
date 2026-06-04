# Testing

## Unit & integration (Vitest)

```bash
npm run test           # run once
npm run test:watch     # watch mode
npm run test:coverage  # coverage (≥80% on scoped modules)
```

Coverage scope is the explicit `coverageInclude` list in `vitest.config.mts` (security, auth, feed, payments, wallets, admin, notifications, media config, API health/creators/ready, etc.). **Threshold: ≥80%** on that list only.

When you add a new pure `lib/` module, add it to `coverageInclude` and add unit tests in the same PR.

## E2E (Playwright)

```bash
npm run dev          # terminal 1 (or reuse existing)
npm run test:e2e     # terminal 2
```

CI runs `npm run build && npm run start` with `CI=true`.

## Layout

- `tests/unit/` — pure logic, schemas, mocked Supabase
- `tests/integration/` — Next.js route handlers
- `tests/e2e/` — browser flows (marketing, auth redirect, public API)
