-- Migration: Home feed ranking (subscription, recency, engagement, creator priority)
-- Fanbase NG

ALTER TABLE creator_profiles
  ADD COLUMN feed_priority INT NOT NULL DEFAULT 0
    CHECK (feed_priority >= 0 AND feed_priority <= 100);

COMMENT ON COLUMN creator_profiles.feed_priority IS
  'Manual boost 0–100 for home feed ranking (higher = more visible)';

CREATE INDEX idx_creator_profiles_feed_priority
  ON creator_profiles (feed_priority DESC)
  WHERE is_accepting_subscribers = true;

CREATE OR REPLACE FUNCTION public.compute_post_feed_score(
  p_post_id UUID,
  p_fan_id UUID
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post RECORD;
  v_creator RECORD;
  v_subscribed BOOLEAN;
  v_likes INT;
  v_comments INT;
  v_recency DOUBLE PRECISION;
  v_subscription DOUBLE PRECISION;
  v_engagement DOUBLE PRECISION;
  v_priority DOUBLE PRECISION;
  v_hours DOUBLE PRECISION;
BEGIN
  SELECT
    p.id,
    p.creator_id,
    p.visibility,
    p.published_at,
    p.stats_cache
  INTO v_post
  FROM posts p
  WHERE p.id = p_post_id;

  IF NOT FOUND OR v_post.published_at IS NULL THEN
    RETURN 0;
  END IF;

  SELECT cp.feed_priority, cp.is_verified
  INTO v_creator
  FROM creator_profiles cp
  WHERE cp.user_id = v_post.creator_id;

  v_subscribed := public.is_active_subscriber(p_fan_id, v_post.creator_id);

  v_likes := COALESCE((v_post.stats_cache ->> 'likes')::INT, 0);
  v_comments := COALESCE((v_post.stats_cache ->> 'comments')::INT, 0);

  v_hours := GREATEST(
    0,
    EXTRACT(EPOCH FROM (now() - v_post.published_at)) / 3600.0
  );

  -- Recency: ~100 pts at publish, decays over ~7 days
  v_recency := 100.0 * exp(-v_hours / 168.0);

  IF v_subscribed THEN
    v_subscription := 1000.0;
  ELSIF v_post.visibility = 'public' THEN
    v_subscription := 150.0;
  ELSE
    v_subscription := 0.0;
  END IF;

  -- Engagement from cached counts
  v_engagement := LEAST(
    250.0,
    (v_likes * 3.0) + (v_comments * 5.0) + sqrt(GREATEST(v_likes + v_comments, 0)::DOUBLE PRECISION) * 10.0
  );

  v_priority := COALESCE(v_creator.feed_priority, 0)::DOUBLE PRECISION * 2.0;
  IF COALESCE(v_creator.is_verified, false) THEN
    v_priority := v_priority + 40.0;
  END IF;

  RETURN v_subscription + v_recency + v_engagement + v_priority;
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.compute_post_feed_score(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ranked_home_feed(UUID, INT, DOUBLE PRECISION, TIMESTAMPTZ, UUID) TO authenticated, service_role;
