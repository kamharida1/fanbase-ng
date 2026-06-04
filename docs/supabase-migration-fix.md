# Supabase setup — new Fanbase project (greenfield)

Fanbase NG migrations are written for a **new, empty** Supabase project. Do **not** apply them to the old PrivyChat database.

## 1. Create a new project

1. [Create a project](https://supabase.com/dashboard/new) (e.g. `fanbase-ng-dev`).
2. Copy **Project URL**, **anon key**, and **service role key** from Settings → API.

## 2. Configure the app

Update `/Users/nnamdiagu/fanbase-ng/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<NEW_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

## 3. Link and push migrations

```bash
cd /Users/nnamdiagu/fanbase-ng
supabase link --project-ref <NEW_PROJECT_REF>
supabase db push
```

You should **not** need `migration repair` or `brownfield-upgrade-all.sql` on a fresh project.

## 4. Auth redirect URLs

In Supabase → Authentication → URL configuration, add:

- `http://localhost:3000/callback`
- `http://localhost:3000/reset-password`

## 5. Optional: backfill profiles

If you import users into `auth.users` without going through signup:

```bash
# Run in SQL Editor: supabase/scripts/backfill-profiles.sql
```

## 6. Run the app

```bash
npm run dev
```

---

## Old PrivyChat project (`gghdwaildyjgmwhfdlun`)

Leave it as-is for PrivyChat. Fanbase NG should use a **different** project ref in `.env.local`.

Brownfield migration patches were **removed** from this repo. A backup of the patched files (if any) may exist under `supabase/migrations/.brownfield-backup/` for reference only.

---

## Do not use `supabase db pull` on PrivyChat

Pulling the remote PrivyChat schema into this repo would overwrite Fanbase’s intended migration chain.
