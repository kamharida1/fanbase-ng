-- Recommendation engine: collaborative filtering for creators + blended "for you" post feed

-- ─── Creator recommendations ──────────────────────────────────────────────────
-- Collaborative filtering: fans who share subscriptions with the viewer also
-- subscribe to these creators. Falls back to most-subscribed creators the fan
-- hasn't followed yet when there's not enough collaborative signal.

CREATE OR REPLACE FUNCTION public.get_recommended_creators(
  p_viewer_id UUID,
  p_limit     INT DEFAULT 8
)
RETURNS TABLE (
  user_id              UUID,
  username             TEXT,
  display_name         TEXT,
  avatar_url           TEXT,
  bio                  TEXT,
  category             TEXT[],
  is_verified          BOOLEAN,
  feed_priority        INT,
  active_sub_count     BIGINT,
  recommendation_score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- Creators the viewer is actively subscribed to
  my_creators AS (
    SELECT DISTINCT s.creator_id
    FROM subscriptions s
    WHERE s.fan_id = p_viewer_id
      AND s.status IN ('active', 'trialing')
  ),

  -- Up to 500 other fans who share at least one creator with the viewer
  similar_fans AS (
    SELECT DISTINCT s.fan_id
    FROM subscriptions s
    WHERE s.creator_id IN (SELECT creator_id FROM my_creators)
      AND s.fan_id <> p_viewer_id
      AND s.status IN ('active', 'trialing')
    LIMIT 500
  ),

  -- Creators those similar fans subscribe to, ranked by number of matching fans
  collab AS (
    SELECT
      s.creator_id,
      COUNT(DISTINCT s.fan_id)::BIGINT AS overlap_count
    FROM subscriptions s
    JOIN similar_fans sf ON sf.fan_id = s.fan_id
    WHERE s.status IN ('active', 'trialing')
      AND s.creator_id NOT IN (SELECT creator_id FROM my_creators)
      AND s.creator_id <> p_viewer_id
    GROUP BY s.creator_id
  ),

  -- Active-subscriber count per candidate creator (for popularity score)
  sub_counts AS (
    SELECT creator_id, COUNT(*)::BIGINT AS cnt
    FROM subscriptions
    WHERE status IN ('active', 'trialing')
    GROUP BY creator_id
  ),

  -- Fallback: popular creators not yet followed
  popular AS (
    SELECT
      cp.user_id AS creator_id,
      0::BIGINT   AS overlap_count
    FROM creator_profiles cp
    JOIN profiles pr ON pr.id = cp.user_id
    WHERE cp.is_accepting_subscribers = true
      AND pr.status = 'active'
      AND cp.user_id NOT IN (SELECT creator_id FROM my_creators)
      AND cp.user_id <> p_viewer_id
      AND NOT EXISTS (
        SELECT 1 FROM fan_blocks fb
        WHERE fb.fan_id = p_viewer_id AND fb.creator_id = cp.user_id
      )
    ORDER BY COALESCE((SELECT cnt FROM sub_counts sc WHERE sc.creator_id = cp.user_id), 0) DESC
    LIMIT 50
  ),

  -- Merge collaborative signal with popularity fallback
  candidates AS (
    SELECT creator_id, overlap_count FROM collab
    UNION ALL
    SELECT creator_id, overlap_count FROM popular
    WHERE creator_id NOT IN (SELECT creator_id FROM collab)
  )

  SELECT
    pr.id                                                     AS user_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    cp.bio,
    cp.category,
    cp.is_verified,
    cp.feed_priority,
    COALESCE(sc.cnt, 0)                                       AS active_sub_count,
    (
      c.overlap_count * 100.0
      + LEAST(COALESCE(sc.cnt, 0), 2000)::DOUBLE PRECISION * 0.05
      + CASE WHEN cp.is_verified     THEN 30.0 ELSE 0.0 END
      + cp.feed_priority::DOUBLE PRECISION * 2.0
    )                                                         AS recommendation_score
  FROM candidates c
  JOIN creator_profiles cp ON cp.user_id = c.creator_id
  JOIN profiles pr          ON pr.id      = c.creator_id
  LEFT JOIN sub_counts sc   ON sc.creator_id = c.creator_id
  WHERE cp.is_accepting_subscribers = true
    AND pr.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM fan_blocks fb
      WHERE fb.fan_id = p_viewer_id AND fb.creator_id = c.creator_id
    )
  ORDER BY recommendation_score DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 8), 24));
$$;

GRANT EXECUTE ON FUNCTION public.get_recommended_creators(UUID, INT)
  TO authenticated, service_role;


-- ─── "For you" blended post feed ─────────────────────────────────────────────
-- Mixes the fan's own ranked feed with trending public posts from recommended
-- creators they don't yet subscribe to. Uses the same cursor shape as
-- get_ranked_home_feed so the client can page through a unified stream.

CREATE OR REPLACE FUNCTION public.get_for_you_posts(
  p_fan_id              UUID,
  p_limit               INT              DEFAULT 20,
  p_cursor_score        DOUBLE PRECISION DEFAULT NULL,
  p_cursor_published_at TIMESTAMPTZ      DEFAULT NULL,
  p_cursor_id           UUID             DEFAULT NULL
)
RETURNS TABLE (
  id                  UUID,
  creator_id          UUID,
  type                TEXT,
  caption             TEXT,
  content_warning     TEXT,
  visibility          post_visibility,
  plan_id             UUID,
  ppv_price_kobo      BIGINT,
  status              post_status,
  moderation_status   moderation_status,
  published_at        TIMESTAMPTZ,
  scheduled_publish_at TIMESTAMPTZ,
  stats_cache         JSONB,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ,
  feed_score          DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH

  -- Up to 20 recommended creators to pull discovery content from
  rec_creators AS (
    SELECT user_id AS creator_id
    FROM public.get_recommended_creators(p_fan_id, 20)
  ),

  -- Subscribed-creator posts: full personalised score
  subscribed_posts AS (
    SELECT
      p.id,
      p.creator_id,
      p.type::TEXT,
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
      AND p.removed_at IS NULL
      AND p.moderation_status = 'approved'
      AND p.published_at IS NOT NULL
      AND p.published_at <= now()
      AND public.is_active_subscriber(p_fan_id, p.creator_id)
      AND public.can_preview_post(p_fan_id, p.id)
  ),

  -- Trending public posts from recommended non-subscribed creators
  discovery_posts AS (
    SELECT
      p.id,
      p.creator_id,
      p.type::TEXT,
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
      -- Trending score (same formula as compute_post_trending_score but inline)
      (
        LEAST(250.0,
          COALESCE((p.stats_cache ->> 'likes')::INT, 0) * 3.0
          + COALESCE((p.stats_cache ->> 'comments')::INT, 0) * 5.0
          + sqrt(GREATEST(
              COALESCE((p.stats_cache ->> 'likes')::INT, 0)
              + COALESCE((p.stats_cache ->> 'comments')::INT, 0), 0)::DOUBLE PRECISION) * 10.0
        )
        -- Decay ~48 h for trending, divided by 3 to blend with subscribed scores
        + 33.0 * exp(-GREATEST(0, EXTRACT(EPOCH FROM (now() - p.published_at)) / 3600.0) / 48.0)
        -- Discovery bonus so non-subscribed content is surfaced but not dominant
        + 150.0
      ) AS feed_score
    FROM posts p
    JOIN rec_creators rc ON rc.creator_id = p.creator_id
    WHERE p.status = 'published'
      AND p.removed_at IS NULL
      AND p.moderation_status = 'approved'
      AND p.visibility = 'public'
      AND p.published_at IS NOT NULL
      AND p.published_at <= now()
      AND p.published_at >= now() - INTERVAL '7 days'
      AND NOT public.is_active_subscriber(p_fan_id, p.creator_id)
  ),

  -- Combine and deduplicate
  combined AS (
    SELECT * FROM subscribed_posts
    UNION ALL
    SELECT * FROM discovery_posts
    WHERE id NOT IN (SELECT id FROM subscribed_posts)
  ),

  scored AS (
    SELECT * FROM combined
    WHERE (
      p_cursor_score IS NULL
      OR (feed_score, published_at, id) < (p_cursor_score, p_cursor_published_at, p_cursor_id)
    )
  )

  SELECT *
  FROM scored
  ORDER BY feed_score DESC, published_at DESC, id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 50));
$$;

GRANT EXECUTE ON FUNCTION public.get_for_you_posts(UUID, INT, DOUBLE PRECISION, TIMESTAMPTZ, UUID)
  TO authenticated, service_role;
