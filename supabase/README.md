# Supabase migrations

Run migrations **in filename order** on a fresh Supabase project.

```bash
supabase link --project-ref <ref>
supabase db push
```

Or paste each file into the SQL Editor in order.

**New project setup** → [docs/supabase-migration-fix.md](../docs/supabase-migration-fix.md) (greenfield `db push` only).

## Migration order (35 files)

| # | File | Contents |
|---|------|----------|
| 01 | `20250603000001_extensions.sql` | `pg_trgm`, `btree_gin` |
| 02 | `20250603000002_enums.sql` | All enum types |
| 03 | `20250603000003_functions.sql` | `set_updated_at`, `handle_new_user`, `create_creator_wallet`, `ensure_monthly_partition` |
| 04 | `20250603000004_profiles.sql` | `profiles` + indexes |
| 05 | `20250603000005_admin.sql` | `admin_roles`, `admin_users` + seed roles |
| 06 | `20250603000006_creators.sql` | `creator_profiles` |
| 07 | `20250603000007_subscription_plans.sql` | `subscription_plans` |
| 08 | `20250603000008_subscriptions.sql` | `subscriptions`, `subscription_events` |
| 09 | `20250603000009_payments.sql` | `payments`, `disputes` |
| 10 | `20250603000010_posts.sql` | `posts`, media, engagement, `post_views` (partitioned) |
| 11 | `20250603000011_messaging.sql` | `conversations`, `messages` (partitioned), `message_purchases` |
| 12 | `20250603000012_wallets.sql` | `wallets`, `wallet_transactions` (partitioned) |
| 13 | `20250603000013_payouts.sql` | `payout_accounts`, `payout_requests` |
| 14 | `20250603000014_notifications.sql` | `notification_preferences`, `notifications` (partitioned) |
| 15 | `20250603000015_moderation.sql` | `reports`, `moderation_queue`, `moderation_actions`, `user_strikes` |
| 16 | `20250603000016_referrals.sql` | Referral program tables |
| 17 | `20250603000017_audit_analytics.sql` | `audit_logs` (partitioned), `earnings_daily`, `user_sessions` |
| 18 | `20250603000018_partition_fks.sql` | Partition FKs + initial monthly partitions |
| 19 | `20250603000019_brin_indexes.sql` | BRIN indexes for time-series tables |
| 20 | `20250603000020_triggers.sql` | `updated_at`, fan wallet, notification prefs |
| 21 | `20250603000021_auth_integration.sql` | `auth.users` → `profiles` trigger |
| 22 | `20250603000022_rls_helpers.sql` | `is_active_subscriber`, `can_view_post`, `is_conversation_participant` |
| 23 | `20250603000023_rls_enable.sql` | `ENABLE ROW LEVEL SECURITY` on all tables |
| 24 | `20250603000024_rls_policies.sql` | Policies for every user-facing table |
| 25 | `20250605000001_subscription_billing.sql` | `billing_interval`, webhook idempotency, period-aware RLS |
| 26 | `20250606000001_paystack_payments.sql` | `payment_refunds`, payment verify columns, webhook audit fields |
| 27 | `20250607000001_wallet_functions.sql` | Wallet credit, clearance, payout reserve, refund reversal RPCs |
| 28 | `20250608000001_messaging_enhancements.sql` | Requests, read receipts, triggers, realtime, RPCs |
| 29 | `20250608000002_message_media_storage.sql` | Private `message-media` storage bucket |
| 30 | `20250609000001_posts_enhancements.sql` | Scheduling, preview RLS, stats, PPV payments policy |
| 31 | `20250609000002_post_media_storage.sql` | Private `post-media` storage bucket |
| 32 | `20250610000001_secure_media_uploads.sql` | `media_uploads` registry, scan hooks, upload FKs |
| 33 | `20250611000001_home_feed_ranking.sql` | `feed_priority`, ranked home feed RPCs |
| 34 | `20250612000001_notifications_system.sql` | Notification RPCs, preferences, Realtime |
| 35 | `20250613000001_admin_dashboard.sql` | Admin stats, moderation trigger, payout review RPCs |

## Auth integration

- **`handle_new_user`** — `AFTER INSERT ON auth.users` creates `profiles` row from signup metadata.
- **`handle_auth_user_updated`** — syncs `email_verified_at` when email is confirmed.
- **`handle_new_profile`** — creates fan `wallets` row + `notification_preferences`.

## Service role writes (no user INSERT policy)

Use **service role** (server-only) for:

- `payments`, `subscription_events`, `wallet_transactions`
- `ppv_purchases`, `message_purchases`, `tips` (after Paystack webhook)
- `notifications` (system-generated)
- `audit_logs`, `moderation_queue`, `moderation_actions`, `admin_users`

## Monthly partitions

Schedule monthly (pg_cron or external cron):

```sql
SELECT public.ensure_monthly_partition('public.messages', (date_trunc('month', now()) + interval '3 months')::date);
SELECT public.ensure_monthly_partition('public.wallet_transactions', (date_trunc('month', now()) + interval '3 months')::date);
SELECT public.ensure_monthly_partition('public.notifications', (date_trunc('month', now()) + interval '3 months')::date);
SELECT public.ensure_monthly_partition('public.audit_logs', (date_trunc('month', now()) + interval '3 months')::date);
SELECT public.ensure_monthly_partition('public.post_views', (date_trunc('month', now()) + interval '3 months')::date);
```

## Archive

Older migrations moved to `migrations/archive/` — do not run alongside this set.

## Docs

[docs/supabase/SCHEMA.md](../docs/supabase/SCHEMA.md)
