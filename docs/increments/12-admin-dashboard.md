# Increment 12 — Admin dashboard

## Access

Staff roles via `admin_users` + `admin_roles` (linked to `profiles`):

| Role | Access |
|------|--------|
| Moderator | Dashboard, content review, reports |
| Admin | All moderator + users, creators, payouts, finance, analytics, audit |

Uses `createAdminClient()` (service role) for reads/writes. All mutations audit-logged.

## Pages

| Path | Feature |
|------|---------|
| `/admin` | Overview stats |
| `/admin/users` | Search, suspend, ban |
| `/admin/creators` | Verify, toggle subs, feed priority |
| `/admin/moderation` | Post queue approve/reject/remove |
| `/admin/reports` | Resolve/dismiss reports |
| `/admin/finance` | 30-day payments & payouts summary |
| `/admin/payouts` | Approve/reject withdrawals |
| `/admin/analytics` | Signups, revenue, top creators |
| `/admin/audit` | Recent audit_logs |

## Content review

Published posts now enter `moderation_status = pending` and auto-enqueue in `moderation_queue` (trigger). Fans see posts only after `approved` via existing RLS.

## Payout RPCs

- `admin_approve_payout_request` — marks completed
- `admin_reject_payout_request` — cancels and restores wallet balance

## Staff setup

Link a profile to `admin_users` with `profile_id` and active role. Without a row, payout approve/reject will fail.

```sql
INSERT INTO admin_users (email, display_name, role_id, profile_id)
SELECT 'ops@example.com', 'Ops', id, '<profile-uuid>'
FROM admin_roles WHERE slug = 'admin';
```

## Migration

`20250613000001_admin_dashboard.sql`
