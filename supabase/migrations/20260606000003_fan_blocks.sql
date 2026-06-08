-- fan_blocks: a fan can block a creator (hides them from feed, blocks messaging)
create table if not exists fan_blocks (
  fan_id     uuid not null references profiles(id) on delete cascade,
  creator_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fan_id, creator_id)
);

create index if not exists fan_blocks_creator_idx on fan_blocks (creator_id);

alter table fan_blocks enable row level security;

-- Fan manages their own block list; creator can read rows where they're blocked
create policy "fan_manages_blocks" on fan_blocks
  for all to authenticated
  using  (fan_id = auth.uid() or creator_id = auth.uid())
  with check (fan_id = auth.uid());

-- Update home feed ranking to exclude creators blocked by the fan
CREATE OR REPLACE FUNCTION public.get_ranked_home_feed(
  p_fan_id UUID,
  p_limit INT DEFAULT 20,
  p_cursor_score DOUBLE PRECISION DEFAULT NULL,
  p_cursor_published_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  type TEXT,
  caption TEXT,
  visibility post_visibility,
  plan_id UUID,
  ppv_price_kobo BIGINT,
  status post_status,
  moderation_status moderation_status,
  published_at TIMESTAMPTZ,
  scheduled_publish_at TIMESTAMPTZ,
  stats_cache JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  feed_score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scored AS (
    SELECT
      p.id,
      p.creator_id,
      p.type,
      p.caption,
      p.visibility,
      p.plan_id,
      p.ppv_price_kobo,
      p.status,
      p.moderation_status,
      p.published_at,
      p.scheduled_publish_at,
      p.stats_cache,
      p.created_at,
      p.updated_at,
      public.compute_post_feed_score(p.id, p_fan_id) AS feed_score
    FROM posts p
    WHERE p.status = 'published'
      AND p.removed_at IS NULL
      AND p.moderation_status = 'approved'
      AND p.published_at IS NOT NULL
      AND p.published_at <= now()
      AND public.can_preview_post(p_fan_id, p.id)
      AND NOT EXISTS (
        SELECT 1 FROM fan_blocks fb
        WHERE fb.fan_id = p_fan_id AND fb.creator_id = p.creator_id
      )
  )
  SELECT
    s.id,
    s.creator_id,
    s.type,
    s.caption,
    s.visibility,
    s.plan_id,
    s.ppv_price_kobo,
    s.status,
    s.moderation_status,
    s.published_at,
    s.scheduled_publish_at,
    s.stats_cache,
    s.created_at,
    s.updated_at,
    s.feed_score
  FROM scored s
  WHERE (
    p_cursor_score IS NULL
    OR (
      s.feed_score,
      s.published_at,
      s.id
    ) < (
      p_cursor_score,
      p_cursor_published_at,
      p_cursor_id
    )
  )
  ORDER BY s.feed_score DESC, s.published_at DESC, s.id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;
