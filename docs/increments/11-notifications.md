# Increment 11 — Notifications

## Event types

| Type | Recipient | Trigger |
|------|-----------|---------|
| `new_subscriber` | Creator | New subscription activated |
| `new_message` | Other party | Message sent in conversation |
| `new_comment` | Post creator | Comment on post |
| `new_like` | Post creator | Fan likes post |
| `new_payout` | Creator | Withdrawal request submitted |

## Stack

- **Storage:** `notifications` table (partitioned), `notification_preferences`
- **Create:** `create_notification` RPC (service role), respects per-type toggles
- **Realtime:** `supabase_realtime` publication on `notifications`
- **UI:** Bell badge + `/notifications` inbox + preferences

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/notifications` | Paginated list (`cursor`, `limit`) |
| GET | `/api/v1/notifications/unread-count` | Badge count |
| POST | `/api/v1/notifications/mark-read` | Mark ids or all read |

## Preferences

JSONB keys on `notification_preferences.preferences`:

`new_subscriber`, `new_message`, `new_comment`, `new_like`, `new_payout` (boolean).

## Migration

`20250612000001_notifications_system.sql`

## Idempotency

`metadata.idempotency_key` prevents duplicate notifications (30-day window).
