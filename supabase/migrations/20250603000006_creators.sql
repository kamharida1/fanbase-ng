-- Migration: 06 — Creator profiles
-- Fanbase NG

CREATE TABLE IF NOT EXISTS creator_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  bio TEXT,
  banner_url TEXT,
  category TEXT[] NOT NULL DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_accepting_subscribers BOOLEAN NOT NULL DEFAULT true,
  platform_fee_bps INT CHECK (
    platform_fee_bps IS NULL
    OR (platform_fee_bps >= 0 AND platform_fee_bps <= 5000)
  ),
  payout_enabled BOOLEAN NOT NULL DEFAULT false,
  min_payout_kobo BIGINT NOT NULL DEFAULT 500000 CHECK (min_payout_kobo >= 0),
  messaging_subscribers_only BOOLEAN NOT NULL DEFAULT false,
  pay_to_message_kobo BIGINT CHECK (pay_to_message_kobo IS NULL OR pay_to_message_kobo >= 0),
  social_links JSONB NOT NULL DEFAULT '{}',
  stats_cache JSONB NOT NULL DEFAULT '{}',
  storage_used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (storage_used_bytes >= 0),
  storage_quota_bytes BIGINT NOT NULL DEFAULT 10737418240 CHECK (storage_quota_bytes > 0),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_profiles_verified ON creator_profiles (is_verified)
  WHERE is_accepting_subscribers = true;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_category ON creator_profiles USING GIN (category);

COMMENT ON TABLE creator_profiles IS 'Creator extension of profiles (1:1)';
