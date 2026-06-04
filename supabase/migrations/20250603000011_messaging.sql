-- Migration: 11 — Conversations & messages
-- Fanbase NG

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  creator_unread_count INT NOT NULL DEFAULT 0 CHECK (creator_unread_count >= 0),
  fan_unread_count INT NOT NULL DEFAULT 0 CHECK (fan_unread_count >= 0),
  is_blocked_by_creator BOOLEAN NOT NULL DEFAULT false,
  is_blocked_by_fan BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_conversations_creator_fan UNIQUE (creator_id, fan_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_creator_inbox
  ON conversations (creator_id, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_conversations_fan_inbox
  ON conversations (fan_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  body TEXT,
  media_r2_key TEXT,
  is_ppv BOOLEAN NOT NULL DEFAULT false,
  ppv_price_kobo BIGINT CHECK (ppv_price_kobo IS NULL OR ppv_price_kobo > 0),
  moderation_status moderation_status NOT NULL DEFAULT 'approved',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at),
  CONSTRAINT messages_body_or_media CHECK (
    is_deleted = true OR body IS NOT NULL OR media_r2_key IS NOT NULL
  ),
  CONSTRAINT messages_ppv_price CHECK (
    (is_ppv = true AND ppv_price_kobo IS NOT NULL) OR (is_ppv = false)
  )
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  message_created_at TIMESTAMPTZ NOT NULL,
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_message_purchases_fan_message UNIQUE (fan_id, message_id, message_created_at)
);

CREATE INDEX IF NOT EXISTS idx_message_purchases_fan ON message_purchases (fan_id, created_at DESC);
