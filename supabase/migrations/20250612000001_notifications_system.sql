-- Migration: In-app notifications — RPCs, preferences, Realtime
-- Fanbase NG

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'new_subscriber',
    'new_message',
    'new_comment',
    'new_like',
    'new_payout'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TYPE notification_type IS 'In-app notification event types';

-- Default per-type toggles inside preferences JSONB
CREATE OR REPLACE FUNCTION public.default_notification_preferences()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'new_subscriber', true,
    'new_message', true,
    'new_comment', true,
    'new_like', true,
    'new_payout', true
  );
$$;

UPDATE notification_preferences
SET preferences = public.default_notification_preferences()
  || COALESCE(preferences, '{}'::jsonb)
WHERE preferences = '{}'::jsonb OR preferences IS NULL;

CREATE OR REPLACE FUNCTION public.notification_type_enabled(
  p_user_id UUID,
  p_type notification_type
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs RECORD;
  v_key TEXT := p_type::TEXT;
  v_val JSONB;
BEGIN
  SELECT email_enabled, preferences
  INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF NOT COALESCE(v_prefs.email_enabled, true) AND p_type::TEXT = 'marketing' THEN
    RETURN false;
  END IF;

  v_val := v_prefs.preferences -> v_key;
  IF v_val IS NULL THEN
    RETURN true;
  END IF;

  RETURN COALESCE((v_val)::BOOLEAN, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_created TIMESTAMPTZ := now();
  v_existing UUID;
BEGIN
  IF NOT public.notification_type_enabled(p_user_id, p_type) THEN
    RETURN NULL;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT n.id INTO v_existing
    FROM notifications n
    WHERE n.user_id = p_user_id
      AND n.metadata ->> 'idempotency_key' = p_idempotency_key
      AND n.created_at > now() - interval '30 days'
    ORDER BY n.created_at DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  INSERT INTO notifications (
    id,
    user_id,
    type,
    title,
    body,
    channel,
    status,
    action_url,
    entity_type,
    entity_id,
    metadata,
    sent_at,
    created_at
  )
  VALUES (
    v_id,
    p_user_id,
    p_type::TEXT,
    p_title,
    p_body,
    'in_app',
    'sent',
    p_action_url,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
      || CASE
        WHEN p_idempotency_key IS NOT NULL
        THEN jsonb_build_object('idempotency_key', p_idempotency_key)
        ELSE '{}'::jsonb
      END,
    v_created,
    v_created
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM notifications n
  WHERE n.user_id = p_user_id
    AND n.read_at IS NULL
    AND n.status IN ('sent', 'pending');
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL,
  p_mark_all BOOLEAN DEFAULT false
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_mark_all THEN
    UPDATE notifications
    SET read_at = now(), status = 'read'
    WHERE user_id = p_user_id
      AND read_at IS NULL;
  ELSIF p_notification_ids IS NOT NULL AND array_length(p_notification_ids, 1) > 0 THEN
    UPDATE notifications
    SET read_at = now(), status = 'read'
    WHERE user_id = p_user_id
      AND id = ANY(p_notification_ids)
      AND read_at IS NULL;
  ELSE
    RETURN 0;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.default_notification_preferences() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notification_type_enabled(UUID, notification_type) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_notification(
  UUID, notification_type, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(UUID, UUID[], BOOLEAN) TO authenticated, service_role;

-- Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
