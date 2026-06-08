-- Migration: voice/video DM calls
-- Fanbase NG

DO $$ BEGIN
  CREATE TYPE call_type AS ENUM ('voice', 'video');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE call_status AS ENUM ('ringing', 'active', 'ended', 'missed', 'declined');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Call history/log. WebRTC signaling itself (SDP offers/answers/ICE candidates)
-- happens over ephemeral Supabase Realtime broadcast channels — never persisted.
-- This table exists purely for call records (missed-call notifications, duration).
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type call_type NOT NULL,
  status call_status NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calls_conversation ON calls (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls (callee_id, created_at DESC);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calls_select_participant" ON calls
  FOR SELECT
  USING (caller_id = auth.uid() OR callee_id = auth.uid());

CREATE POLICY "calls_insert_caller" ON calls
  FOR INSERT
  WITH CHECK (
    caller_id = auth.uid()
    AND public.is_conversation_participant(auth.uid(), conversation_id)
    AND public.is_conversation_participant(callee_id, conversation_id)
  );

-- Either participant can update status (answer/decline/hang up).
CREATE POLICY "calls_update_participant" ON calls
  FOR UPDATE
  USING (caller_id = auth.uid() OR callee_id = auth.uid())
  WITH CHECK (caller_id = auth.uid() OR callee_id = auth.uid());

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'missed_call';
