# Increment 6 — Creator wallets

## Features

| Feature | Implementation |
|---------|----------------|
| Earnings tracking | `earnings_daily` + `credit_creator_from_payment` RPC |
| Available balance | `wallets.available_kobo` (after clearance) |
| Pending balance | `wallets.pending_kobo` (7-day clearance by default) |
| Withdrawal requests | `create_creator_payout_request` RPC + UI |
| Transaction history | `wallet_transactions` + creator earnings UI |

## Fees (on credit)

- Platform: 20% (`PLATFORM_FEE_BPS`)
- Payment processing estimate: 1.5% (`PAYMENT_FEE_BPS`)
- Net credited to **pending**; cron moves to **available**

## Setup

1. Run `20250607000001_wallet_functions.sql` after prior migrations.
2. Set `WALLET_ENCRYPTION_KEY` (optional; falls back to service role key in dev).
3. Cron: `POST /api/internal/cron/wallet-clearance` every 6h (see `vercel.json`).

## Key paths

- RPC migration: `supabase/migrations/20250607000001_wallet_functions.sql`
- Ledger: `lib/wallets/ledger.ts`
- Actions: `lib/wallets/actions.ts`
- UI: `components/wallet/*`, `/creator/dashboard`, `/creator/earnings`, `/creator/withdrawals`

Payment success automatically credits the creator wallet via `lib/payments/processor.ts`.
