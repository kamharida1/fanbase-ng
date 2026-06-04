# Increment 8 — Creator posts

## Features

| Feature | Implementation |
|---------|----------------|
| Text / image / video | `posts.type` + `post_media` |
| Scheduling | `scheduled_publish_at` + cron `publish_due_scheduled_posts` |
| Drafts | `status = draft` |
| Likes | `post_likes` + stats cache trigger |
| Comments | `post_comments` |
| Public | `visibility = public` |
| Subscribers | `visibility = subscribers` + RLS |
| Tier | `visibility = tier` + `plan_id` |
| PPV | `visibility = ppv` + Paystack unlock + `ppv_purchases` |

## Access control

- `can_preview_post` — feed cards (includes locked PPV for subscribers)
- `can_view_post` — full content/media (purchase required for PPV)
- Creators always see own drafts via `posts_select_own`

## Migrations

- `20250609000001_posts_enhancements.sql`
- `20250609000002_post_media_storage.sql`

## Paths

- Creator studio: `/creator/content`, `/creator/content/new`, `/creator/content/[id]/edit`
- Fan feed: `/feed`
- Cron: `POST /api/internal/cron/publish-scheduled-posts` (every 15 min)

## Storage

Create `post-media` bucket (migration) for private images/videos with signed URLs.
