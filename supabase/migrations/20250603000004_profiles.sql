-- Migration: 04 — Users (profiles)
-- Fanbase NG

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'fan',
  status user_status NOT NULL DEFAULT 'active',
  phone TEXT,
  phone_verified_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  country_code CHAR(2) NOT NULL DEFAULT 'NG',
  locale TEXT NOT NULL DEFAULT 'en-NG',
  kyc_status kyc_status NOT NULL DEFAULT 'none',
  referred_by_code TEXT,
  referral_applied_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(username, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(display_name, '')), 'B')
  ) STORED,
  last_seen_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_]{3,30}$'),
  CONSTRAINT profiles_phone_e164 CHECK (
    phone IS NULL OR phone ~ '^\+[1-9]\d{6,14}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username_active
  ON profiles (lower(username))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles (role, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles (last_seen_at DESC NULLS LAST)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_search ON profiles USING GIN (search_vector);

COMMENT ON TABLE profiles IS 'Platform users; id matches auth.users';
