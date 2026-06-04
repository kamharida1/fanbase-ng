# Authentication (Supabase Auth)

## Features

| Feature | Route / file |
|---------|----------------|
| Email signup | `/signup` — `SignupForm` |
| Email login | `/login` — `LoginForm` |
| Password reset | `/forgot-password` → email → `/reset-password` |
| Email verification | `/verify` + `/callback` |
| Session tracking | `user_sessions` table, Settings page |
| Protected routes | `middleware.ts` + layout `requireRole` |
| RBAC | `lib/auth/rbac.ts` |

## Roles

| App role | Source |
|----------|--------|
| **User** | `profiles.role = fan` |
| **Creator** | `profiles.role = creator` |
| **Moderator** | `admin_users` + `admin_roles.slug = moderator` |
| **Admin** | `admin_roles.slug = admin` |
| **Super Admin** | `admin_roles.slug = super_admin` |

Staff roles override profile role. Higher roles inherit lower permissions (`ROLE_RANK`).

## Default redirects after login

| Role | Path |
|------|------|
| User | `/feed` |
| Creator | `/creator/dashboard` |
| Moderator | `/admin/moderation` |
| Admin / Super Admin | `/admin/users` |

## Supabase dashboard setup

1. **Authentication → Providers:** Enable Email.
2. **URL configuration:** Add redirect URLs:
   - `http://localhost:3000/callback`
   - `http://localhost:3000/reset-password`
   - Production URLs when deployed.
3. **Email templates:** Customize confirm & reset emails (optional).

## Staff access

Link a platform user to staff:

```sql
INSERT INTO admin_users (email, display_name, role_id, profile_id, is_active)
SELECT
  'ops@example.com',
  'Ops User',
  (SELECT id FROM admin_roles WHERE slug = 'admin'),
  '<profiles.uuid>',
  true;
```

## Delete a user (Dashboard fails)

Supabase Dashboard → **Authentication → Delete user** can fail with `Database error deleting user` when `public.payments` or `admin_users` still reference the profile (FK without `ON DELETE CASCADE`).

**One-off delete:** edit and run [supabase/scripts/admin-delete-user.sql](../supabase/scripts/admin-delete-user.sql) in the SQL Editor (paste the user UUID).

**Fix for future deletes:** apply migration `20250616000001_profile_fk_on_delete.sql`:

```bash
supabase db push
```

**Diagnose blockers:** [supabase/scripts/diagnose-user-delete-blockers.sql](../supabase/scripts/diagnose-user-delete-blockers.sql)

## API protection

```typescript
import { requireApiAuth } from "@/lib/auth/api";

const authResult = await requireApiAuth("creator");
if (authResult instanceof NextResponse) return authResult;
const { ctx } = authResult;
```
