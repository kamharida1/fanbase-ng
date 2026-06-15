# Paystack subscriptions — implementation reference

## Flow

1. **Initialize** — `startSubscription()` inserts `payments` (pending) + calls Paystack `/transaction/initialize`.
2. **Redirect** — Fan pays on Paystack; callback URL includes `reference`.
3. **Verify** — `POST /api/v1/payments/verify` calls Paystack `/transaction/verify/:reference` (idempotent).
4. **Webhook** — `POST /api/v1/webhooks/paystack` with HMAC signature (source of truth if verify races).

## Security

| Control | Location |
|---------|----------|
| Signature verification | `lib/paystack/verify.ts` (timing-safe HMAC-SHA512) |
| Webhook idempotency | `paystack_webhook_events.event_id` unique |
| Payment idempotency | `payments.paystack_reference` + `idempotency_key` |
| Audit trail | `audit_logs` via `lib/audit/log.ts` (service role) |

## Webhook events handled

| Event | Action |
|-------|--------|
| `charge.success` | Activate subscription or record renewal |
| `charge.failed` | Mark payment `failed` |
| `refund.pending` / `refund.processed` / `refund.failed` | `payment_refunds` + revoke access on processed |
| `subscription.create` | Link `paystack_subscription_code` |
| `invoice.payment_failed` | Subscription → `past_due` |
| `subscription.disable` / `subscription.not_renew` | Cancel at period end |

## Migrations

- `20250605000001_subscription_billing.sql` — billing intervals, webhook table
- `20250606000001_paystack_payments.sql` — refunds, payment columns, webhook audit fields

## Env

```
PAYSTACK_SECRET_KEY=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Paystack dashboard webhook URL: `https://<app>/api/v1/webhooks/paystack`

### Shared Paystack account with PrepNG

Paystack allows one Live webhook URL per business. To run Fanbase and PrepNG on the same account:

1. Set Paystack Live webhook to **`https://fanbaseng.com/api/v1/webhooks/paystack`**
2. Set Vercel env **`PREPNG_PAYSTACK_WEBHOOK_URL=https://prepng.com/api/paystack/webhook`**
   — Fanbase verifies and processes, then forwards a copy to PrepNG (same body + signature).
3. PrepNG must **not** forward events back to Fanbase when it receives `x-forwarded-by: fanbaseng`.

**Alternative** (keep Paystack on PrepNG temporarily): forward from PrepNG to  
`https://fanbaseng.com/api/v1/webhooks/paystack/inbound` with the raw body and `x-paystack-signature`.
