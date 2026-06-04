-- Migration: Messaging — requests, read receipts, attachments metadata, realtime, triggers
-- Fanbase NG

DO $$ BEGIN
  CREATE TYPE conversation_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'declined';

ALTER TABLE conversations
  ADD COLUMN status conversation_status NOT NULL DEFAULT 'accepted',
  ADD COLUMN initiated_by UUID REFERENCES profiles(id),
  ADD COLUMN accepted_at TIMESTAMPTZ,
  ADD COLUMN declined_at TIMESTAMPTZ,
  ADD COLUMN last_message_sender_id UUID REFERENCES profiles(id);

COMMENT ON COLUMN conversations.status IS
  'pending = fan request awaiting creator; accepted = full DM; declined = closed';

CREATE INDEX idx_conversations_creator_requests
  ON conversations (creator_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX idx_conversations_fan_pending
  ON conversations (fan_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE messages
  ADD COLUMN attachment_type TEXT CHECK (
    attachment_type IS NULL OR attachment_type IN ('image', 'video', 'audio', 'file')
  ),
  ADD COLUMN attachment_mime TEXT,
  ADD COLUMN attachment_filename TEXT,
  ADD COLUMN attachment_size_bytes BIGINT CHECK (
    attachment_size_bytes IS NULL OR attachment_size_bytes > 0
  );

CREATE TABLE message_reads (
  message_id UUID NOT NULL,
  message_created_at TIMESTAMPTZ NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, message_created_at, user_id)
);

CREATE INDEX idx_message_reads_user ON message_reads (user_id, read_at DESC);

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_reads_select_participant ON message_reads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = message_reads.message_id
        AND m.created_at = message_reads.message_created_at
        AND (c.fan_id = auth.uid() OR c.creator_id = auth.uid())
    )
  );

CREATE POLICY message_reads_insert_own ON message_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Conversation + message triggers
CREATE OR REPLACE FUNCTION public.on_message_insert_update_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv conversations%ROWTYPE;
  v_preview TEXT;
  v_recipient_is_creator BOOLEAN;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;

  v_preview := LEFT(
    COALESCE(
      NULLIF(TRIM(NEW.body), ''),
      CASE
        WHEN NEW.media_r2_key IS NOT NULL THEN '[Attachment]'
        ELSE '[Message]'
      END
    ),
    120
  );

  v_recipient_is_creator := (NEW.sender_id = v_conv.fan_id);

  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = v_preview,
    last_message_sender_id = NEW.sender_id,
    updated_at = now(),
    creator_unread_count = CASE
      WHEN v_recipient_is_creator THEN creator_unread_count + 1
      ELSE creator_unread_count
    END,
    fan_unread_count = CASE
      WHEN NOT v_recipient_is_creator THEN fan_unread_count + 1
      ELSE fan_unread_count
    END,
    status = CASE
      WHEN v_conv.status = 'pending' AND NEW.sender_id = v_conv.creator_id THEN 'accepted'::conversation_status
      ELSE v_conv.status
    END,
    accepted_at = CASE
      WHEN v_conv.status = 'pending' AND NEW.sender_id = v_conv.creator_id THEN COALESCE(v_conv.accepted_at, now())
      ELSE v_conv.accepted_at
    END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_after_insert_conversation
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.is_deleted = false)
  EXECUTE FUNCTION public.on_message_insert_update_conversation();

-- Brownfield: PrivyChat may define these with different return types (42P13 on OR REPLACE).
DO $drop_messaging_fns$
DECLARE
  r REGPROCEDURE;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mark_conversation_read'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r);
  END LOOP;
END $drop_messaging_fns$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv conversations%ROWTYPE;
  v_count INT := 0;
  r RECORD;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;

  IF p_user_id IS DISTINCT FROM v_conv.fan_id AND p_user_id IS DISTINCT FROM v_conv.creator_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR r IN
    SELECT m.id, m.created_at
    FROM messages m
    WHERE m.conversation_id = p_conversation_id
      AND m.sender_id <> p_user_id
      AND m.is_deleted = false
      AND NOT EXISTS (
        SELECT 1 FROM message_reads mr
        WHERE mr.message_id = m.id
          AND mr.message_created_at = m.created_at
          AND mr.user_id = p_user_id
      )
  LOOP
    INSERT INTO message_reads (message_id, message_created_at, user_id)
    VALUES (r.id, r.created_at, p_user_id)
    ON CONFLICT DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  IF p_user_id = v_conv.fan_id THEN
    UPDATE conversations SET fan_unread_count = 0, updated_at = now()
    WHERE id = p_conversation_id;
  ELSE
    UPDATE conversations SET creator_unread_count = 0, updated_at = now()
    WHERE id = p_conversation_id;
  END IF;

  RETURN v_count;
END;
$$;

DO $drop_get_or_create_conversation$
DECLARE
  r REGPROCEDURE;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_or_create_conversation'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r);
  END LOOP;
END $drop_get_or_create_conversation$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_fan_id UUID,
  p_creator_id UUID,
  p_initiator_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_status conversation_status;
BEGIN
  IF p_initiator_id IS DISTINCT FROM p_fan_id AND p_initiator_id IS DISTINCT FROM p_creator_id THEN
    RAISE EXCEPTION 'invalid initiator';
  END IF;

  SELECT id INTO v_id
  FROM conversations
  WHERE fan_id = p_fan_id AND creator_id = p_creator_id;

  IF FOUND THEN
    RETURN v_id;
  END IF;

  IF p_initiator_id = p_creator_id THEN
    v_status := 'accepted';
  ELSE
    v_status := 'pending';
  END IF;

  INSERT INTO conversations (
    fan_id,
    creator_id,
    status,
    initiated_by,
    accepted_at
  ) VALUES (
    p_fan_id,
    p_creator_id,
    v_status,
    p_initiator_id,
    CASE WHEN v_status = 'accepted' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

DO $drop_set_conversation_request_status$
DECLARE
  r REGPROCEDURE;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_conversation_request_status'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s', r);
  END LOOP;
END $drop_set_conversation_request_status$;

CREATE OR REPLACE FUNCTION public.set_conversation_request_status(
  p_conversation_id UUID,
  p_actor_id UUID,
  p_status conversation_status
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM conversations WHERE id = p_conversation_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'conversation not found'; END IF;

  IF p_actor_id IS DISTINCT FROM v_conv.creator_id THEN
    RAISE EXCEPTION 'only creator can manage requests';
  END IF;

  IF v_conv.status <> 'pending' THEN
    RAISE EXCEPTION 'conversation is not a pending request';
  END IF;

  IF p_status = 'accepted' THEN
    UPDATE conversations
    SET status = 'accepted', accepted_at = now(), declined_at = NULL, updated_at = now()
    WHERE id = p_conversation_id;
  ELSIF p_status = 'declined' THEN
    UPDATE conversations
    SET status = 'declined', declined_at = now(), updated_at = now()
    WHERE id = p_conversation_id;
  ELSE
    RAISE EXCEPTION 'invalid status transition';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_conversation FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_conversation_request_status FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_conversation_request_status TO authenticated, service_role;

-- Realtime
ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE message_reads REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
