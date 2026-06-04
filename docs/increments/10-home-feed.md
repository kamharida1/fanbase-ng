# Increment 10 — Home feed

## Ranking (`compute_post_feed_score`)

| Factor | Weight (approx.) |
|--------|------------------|
| **Subscription** | +1000 if active subscriber; +150 for public posts from non-subscribed creators |
| **Recency** | Up to +100, exponential decay (~7 day half-life) |
| **Engagement** | Up to +250 from `stats_cache` likes/comments |
| **Creator priority** | `feed_priority` × 2 (0–100), +40 if verified |

Posts are filtered with `can_preview_post` (RLS-aligned).

## Pagination

- Cursor: base64url JSON `{ score, publishedAt, id }`
- SQL: `get_ranked_home_feed(fan_id, limit, cursor_*)`
- Fetch `limit + 1` to detect `hasMore`

## API

`GET /api/v1/feed?cursor=&limit=15`

- `Cache-Control: private, max-age=60, stale-while-revalidate=120`
- `?fresh=1` skips Next.js data cache

## Caching

- Server: `unstable_cache` per user + cursor (`revalidate: 60`, tag `feed:user:{id}`)
- Invalidated on post actions via `revalidateTag(feedCacheTag(userId))`
- Client: browser HTTP cache on feed API; infinite scroll appends in memory

## UI

- `/feed` — SSR first page + `HomeFeed` infinite scroll
- Comments lazy-loaded per post (`GET /api/v1/posts/[postId]/comments`)

## Migration

`20250611000001_home_feed_ranking.sql` — `creator_profiles.feed_priority`, ranking RPCs
