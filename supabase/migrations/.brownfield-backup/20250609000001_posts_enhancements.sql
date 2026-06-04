-- Migration: Posts — scheduling, preview access, publish cron, stats
-- Fanbase NG

ALTER TABLE posts
  ADD COLUMN scheduled_publish_at TIMESTAMPTZ;

CREATE INDEX idx_posts_scheduled_publish
  ON posts (scheduled_publish_at)
  WHERE status = 'draft' AND scheduled_publish_at IS NOT NULL;

ALTER TABLE posts
  ADD CONSTRAINT posts_type_check CHECK (type IN ('text', 'image', 'video'));

COMMENT ON COLUMN posts.scheduled_publish_at IS
  'When set on draft, cron publishes at this time';

-- Creator always sees own posts (drafts, scheduled, etc.)
CREATE POLICY posts_select_own ON posts
  FOR SELECT TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY post_media_select_own ON post_media
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = post_media.post_id AND p.creator_id = auth.uid()
    )
  );

-- Preview in feed (includes locked PPV for subscribers)
CREATE OR REPLACE FUNCTION public.can_preview_post(
  p_user_id UUID,
  p_post_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post RECORD;
BEGIN
  SELECT creator_id, visibility, plan_id, status, moderation_status, removed_at, published_at
  INTO v_post
  FROM posts
  WHERE id = p_post_id;

  IF NOT FOUND OR v_post.removed_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF v_post.creator_id = p_user_id THEN
    RETURN true;
  END IF;

  IF v_post.status <> 'published' THEN
    RETURN false;
  END IF;

  IF v_post.published_at IS NOT NULL AND v_post.published_at > now() THEN
    RETURN false;
  END IF;

  IF v_post.moderation_status <> 'approved' THEN
    RETURN false;
  END IF;

  IF v_post.visibility = 'public' THEN
    RETURN true;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_post.visibility IN ('subscribers', 'ppv') THEN
    RETURN public.is_active_subscriber(p_user_id, v_post.creator_id);
  END IF;

  IF v_post.visibility = 'tier' THEN
    RETURN EXISTS (
      SELECT 1
      FROM subscriptions s
      WHERE s.fan_id = p_user_id
        AND s.creator_id = v_post.creator_id
        AND s.plan_id = v_post.plan_id
        AND s.status IN ('trialing', 'active', 'past_due')
        AND (
          s.current_period_end IS NULL
          OR s.current_period_end > now()
        )
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_post(p_user_id UUID, p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post RECORD;
BEGIN
  SELECT creator_id, visibility, plan_id, status, moderation_status, removed_at, published_at
  INTO v_post
  FROM posts
  WHERE id = p_post_id;

  IF NOT FOUND OR v_post.removed_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF v_post.creator_id = p_user_id THEN
    RETURN true;
  END IF;

  IF v_post.status <> 'published' THEN
    RETURN false;
  END IF;

  IF v_post.published_at IS NOT NULL AND v_post.published_at > now() THEN
    RETURN false;
  END IF;

  IF v_post.moderation_status <> 'approved' THEN
    RETURN false;
  END IF;

  IF v_post.visibility = 'public' THEN
    RETURN true;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_post.visibility = 'subscribers' THEN
    RETURN public.is_active_subscriber(p_user_id, v_post.creator_id);
  END IF;

  IF v_post.visibility = 'tier' THEN
    RETURN EXISTS (
      SELECT 1
      FROM subscriptions s
      WHERE s.fan_id = p_user_id
        AND s.creator_id = v_post.creator_id
        AND s.plan_id = v_post.plan_id
        AND s.status IN ('trialing', 'active', 'past_due')
        AND (
          s.current_period_end IS NULL
          OR s.current_period_end > now()
        )
    );
  END IF;

  IF v_post.visibility = 'ppv' THEN
    RETURN EXISTS (
      SELECT 1 FROM ppv_purchases pp
      WHERE pp.fan_id = p_user_id AND pp.post_id = p_post_id
    );
  END IF;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS posts_select_accessible ON posts;
CREATE POLICY posts_select_accessible ON posts
  FOR SELECT TO authenticated, anon
  USING (public.can_preview_post(auth.uid(), id));

CREATE OR REPLACE FUNCTION public.publish_due_scheduled_posts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM posts
    WHERE status = 'draft'
      AND scheduled_publish_at IS NOT NULL
      AND scheduled_publish_at <= now()
      AND removed_at IS NULL
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE posts
    SET
      status = 'published',
      published_at = scheduled_publish_at,
      moderation_status = 'approved',
      updated_at = now()
    WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_post_stats_cache(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_likes BIGINT;
  v_comments BIGINT;
BEGIN
  SELECT COUNT(*)::bigint INTO v_likes FROM post_likes WHERE post_id = p_post_id;
  SELECT COUNT(*)::bigint INTO v_comments
  FROM post_comments
  WHERE post_id = p_post_id AND is_deleted = false;

  UPDATE posts
  SET stats_cache = jsonb_build_object(
    'likes', v_likes,
    'comments', v_comments,
    'updated_at', now()
  )
  WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_post_like_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_post_stats_cache(NEW.post_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_post_stats_cache(OLD.post_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS post_likes_refresh_stats ON post_likes;
CREATE TRIGGER post_likes_refresh_stats
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_post_like_change();

CREATE OR REPLACE FUNCTION public.on_post_comment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_post_stats_cache(NEW.post_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted IS DISTINCT FROM NEW.is_deleted THEN
    PERFORM public.refresh_post_stats_cache(NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_comments_refresh_stats ON post_comments;
CREATE TRIGGER post_comments_refresh_stats
  AFTER INSERT OR UPDATE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION public.on_post_comment_change();

GRANT EXECUTE ON FUNCTION public.can_preview_post(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.publish_due_scheduled_posts() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_post_stats_cache(UUID) TO authenticated, service_role;

CREATE POLICY payments_insert_ppv_checkout ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    payer_id = auth.uid()
    AND status = 'pending'
    AND type = 'ppv'
  );
