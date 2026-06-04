-- Migration: 22 — RLS helper functions (require all tables)
-- Fanbase NG

CREATE OR REPLACE FUNCTION public.is_active_subscriber(
  p_fan_id UUID,
  p_creator_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.fan_id = p_fan_id
      AND s.creator_id = p_creator_id
      AND s.status IN ('trialing', 'active', 'past_due')
  );
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
  SELECT creator_id, visibility, plan_id, status, moderation_status, removed_at
  INTO v_post
  FROM posts
  WHERE id = p_post_id;

  IF NOT FOUND OR v_post.status <> 'published' OR v_post.removed_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF v_post.moderation_status <> 'approved' THEN
    RETURN v_post.creator_id = p_user_id;
  END IF;

  IF v_post.creator_id = p_user_id THEN
    RETURN true;
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

CREATE OR REPLACE FUNCTION public.is_conversation_participant(
  p_user_id UUID,
  p_conversation_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = p_conversation_id
      AND (c.fan_id = p_user_id OR c.creator_id = p_user_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_subscriber(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_post(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(UUID, UUID) TO authenticated;
