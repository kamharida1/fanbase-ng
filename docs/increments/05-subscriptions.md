# Increment 5 — Subscriptions

## Capabilities

- **Monthly / annual / free** plans (`billing_interval` on `subscription_plans`)
- **Subscribe** — free activates immediately; paid opens Paystack checkout
- **Cancel** — `cancel_at_period_end`; Paystack subscription disabled when linked
- **Renew** — Paystack `charge.success` (recurring) extends period; cron handles lapse
- **Expiration** — daily cron marks `past_due` → `expired` after grace
- **Access** — `is_active_subscriber` / `can_view_post` respect `current_period_end`

## Setup

1. Run migrations `20250605000001_subscription_billing.sql` and `20250606000001_paystack_payments.sql`
2. Set `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`
3. Configure Paystack webhook: `https://<app>/api/v1/webhooks/paystack`
4. Deploy with `vercel.json` cron or call `POST /api/internal/cron/subscription-reconcile` with `Authorization: Bearer <CRON_SECRET>`

See **Paystack** (initialization, webhooks, verify, refunds, audit): `docs/increments/05-paystack.md`.

## Key paths

| Area | Path |
|------|------|
| Checkout | `lib/subscriptions/service.ts` |
| Paystack webhook | `lib/paystack/webhook-handler.ts` |
| Payment processor | `lib/payments/processor.ts` |
| Verify API | `app/api/v1/payments/verify/route.ts` |
| Audit | `lib/audit/log.ts` |
| Fan UI | `app/(fan)/subscriptions`, `components/subscriptions/*` |
