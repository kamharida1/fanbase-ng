# Increment 3 — Creator profiles

## Features

- Public page: `/creators/[username]`
- Creator studio: `/creator/profile`, `/creator/tiers`
- Become a creator: Settings → **Start creator setup**
- Subscription plans (DB only; Paystack in Increment 5)

## Supabase

1. Run migrations through `20250604000001_profile_media_storage.sql` if using image upload.
2. Or use **image URL fields** only (no bucket required).

## Test flow

1. Sign in as a fan → **Settings** → **Start creator setup**
2. **Creator → Profile** — display name, bio, photos, social links
3. **Creator → Plans** — add a tier (price in NGN)
4. Open `/creators/yourusername` (logged out or incognito)

## API

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/creators` | Public |
| GET | `/api/v1/creators/[username]` | Public |
| GET/PATCH | `/api/v1/creators/me` | User / Creator |
| GET/POST | `/api/v1/creators/me/plans` | Creator |
| PATCH/DELETE | `/api/v1/creators/me/plans/[id]` | Creator |

Verification badge (`is_verified`) is set by admins in DB until admin UI ships.
