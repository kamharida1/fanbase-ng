-- Migration: 06 — Creator profiles
-- Fanbase NG
-- Idempotent: upgrades legacy creator_profiles (PrivyChat) before indexes.

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

ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS category TEXT[] DEFAULT '{}';
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS is_accepting_subscribers BOOLEAN DEFAULT true;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS platform_fee_bps INT;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS payout_enabled BOOLEAN DEFAULT false;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS min_payout_kobo BIGINT DEFAULT 500000;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS messaging_subscribers_only BOOLEAN DEFAULT false;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS pay_to_message_kobo BIGINT;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS stats_cache JSONB DEFAULT '{}';
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 10737418240;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE creator_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE creator_profiles SET category = '{}' WHERE category IS NULL;
UPDATE creator_profiles SET is_verified = false WHERE is_verified IS NULL;
UPDATE creator_profiles SET is_accepting_subscribers = true WHERE is_accepting_subscribers IS NULL;
UPDATE creator_profiles SET payout_enabled = false WHERE payout_enabled IS NULL;
UPDATE creator_profiles SET min_payout_kobo = 500000 WHERE min_payout_kobo IS NULL;
UPDATE creator_profiles SET messaging_subscribers_only = false WHERE messaging_subscribers_only IS NULL;
UPDATE creator_profiles SET social_links = '{}' WHERE social_links IS NULL;
UPDATE creator_profiles SET stats_cache = '{}' WHERE stats_cache IS NULL;
UPDATE creator_profiles SET storage_used_bytes = 0 WHERE storage_used_bytes IS NULL;
UPDATE creator_profiles SET storage_quota_bytes = 10737418240 WHERE storage_quota_bytes IS NULL;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_verified ON creator_profiles (is_verified)
  WHERE is_accepting_subscribers = true;

CREATE INDEX IF NOT EXISTS idx_creator_profiles_category ON creator_profiles USING GIN (category);

COMMENT ON TABLE creator_profiles IS 'Creator extension of profiles (1:1)';
