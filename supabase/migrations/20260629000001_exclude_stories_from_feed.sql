-- Stories (is_story = true) must never appear as regular feed posts.
-- Re-create get_ranked_home_feed with the same signature, adding the missing filter.
DROP FUNCTION IF EXISTS public.get_ranked_home_feed(UUID, INT, DOUBLE PRECISION, TIMESTAMPTZ, UUID);
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
  content_warning TEXT,
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
      p.content_warning,
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
      AND p.is_story IS NOT TRUE
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
    s.content_warning,
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
