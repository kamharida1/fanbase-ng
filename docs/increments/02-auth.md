# Increment 2 — Authentication

**Goal:** Sign up, sign in, sign out. A `profiles` row is created automatically.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers:** enable Email.
3. **Authentication → URL configuration:** add `http://localhost:3000/callback` to redirect URLs.

## 2. Environment

```bash
cp .env.example .env.local
```

Set at minimum:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 3. Database (profiles only)

In the Supabase SQL editor, run:

`supabase/migrations/archive/20250602000000_increment_02_profiles.sql`

For the **full platform**, use the ordered set in `supabase/README.md` instead.

## 4. Run app

```bash
npm run dev
```

## 5. Test

| Step | Expected |
|------|----------|
| Open `/signup` | Form works |
| Sign up with email + password | Redirect to `/verify` or `/feed` |
| Confirm email (if enabled) | Can sign in |
| Open `/feed` while logged out | Redirect to `/login` |
| Sign in | Lands on `/feed` with your display name |
| Sign out | Back to `/login` |

## Done when

- [ ] `profiles` row exists in Supabase Table Editor for your user
- [ ] Protected routes require login
- [ ] Sign out works

**Next:** [Increment 3 — Creator onboarding](../ROADMAP.md#increment-3--creator-onboarding-no-payments)
