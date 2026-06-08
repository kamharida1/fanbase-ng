-- Migration: Post hashtags + full-text search + trending
-- Fanbase NG

ALTER TABLE posts
  ADD COLUMN hashtags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN posts.hashtags IS
  'Lowercased hashtag tokens parsed from caption at save time (no leading #)';

CREATE INDEX idx_posts_hashtags ON posts USING gin (hashtags);

-- Non-personalized engagement + recency score for platform-wide trending
CREATE OR REPLACE FUNCTION public.compute_post_trending_score(
  p_post_id UUID
)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post RECORD;
  v_likes INT;
  v_comments INT;
  v_hours DOUBLE PRECISION;
  v_recency DOUBLE PRECISION;
  v_engagement DOUBLE PRECISION;
BEGIN
  SELECT published_at, stats_cache
  INTO v_post
  FROM posts
  WHERE id = p_post_id;

  IF NOT FOUND OR v_post.published_at IS NULL THEN
    RETURN 0;
  END IF;

  v_likes := COALESCE((v_post.stats_cache ->> 'likes')::INT, 0);
  v_comments := COALESCE((v_post.stats_cache ->> 'comments')::INT, 0);

  v_hours := GREATEST(
    0,
    EXTRACT(EPOCH FROM (now() - v_post.published_at)) / 3600.0
  );

  -- Faster decay than the home feed (~2 days) since trending favors what's hot now
  v_recency := 100.0 * exp(-v_hours / 48.0);

  v_engagement := (v_likes * 3.0) + (v_comments * 5.0)
    + sqrt(GREATEST(v_likes + v_comments, 0)::DOUBLE PRECISION) * 10.0;

  RETURN v_engagement + v_recency;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trending_posts(
  p_fan_id UUID,
  p_limit INT DEFAULT 20
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
  is_pinned BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  trending_score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    p.is_pinned,
    p.created_at,
    p.updated_at,
    public.compute_post_trending_score(p.id) AS trending_score
  FROM posts p
  WHERE p.status = 'published'
    AND p.removed_at IS NULL
    AND p.moderation_status = 'approved'
    AND p.published_at IS NOT NULL
    AND p.published_at <= now()
    AND p.published_at >= now() - interval '7 days'
    AND public.can_preview_post(p_fan_id, p.id)
  ORDER BY trending_score DESC, p.published_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;

CREATE OR REPLACE FUNCTION public.get_trending_hashtags(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  hashtag TEXT,
  post_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h AS hashtag, COUNT(*) AS post_count
  FROM posts p, unnest(p.hashtags) AS h
  WHERE p.status = 'published'
    AND p.removed_at IS NULL
    AND p.moderation_status = 'approved'
    AND p.published_at IS NOT NULL
    AND p.published_at >= now() - interval '7 days'
  GROUP BY h
  ORDER BY post_count DESC, h ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 30));
$$;

GRANT EXECUTE ON FUNCTION public.compute_post_trending_score(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_trending_posts(UUID, INT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_trending_hashtags(INT) TO authenticated, anon, service_role;
