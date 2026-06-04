-- Migration: 04 — Users (profiles)
-- Fanbase NG
-- PrivyChat used a VIEW named profiles; Fanbase requires a real table.

-- Ensure enums exist (migration 02 may be marked applied but incomplete on legacy DBs)
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('fan', 'creator', 'admin', 'moderator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.user_status AS ENUM (
    'active', 'suspended', 'banned', 'pending_verification', 'deleted'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Legacy kyc_status without label 'none': cannot ADD VALUE + use it in same txn (PG 55P04).
-- Rename old type, create Fanbase kyc_status (existing columns keep the legacy type).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'kyc_status'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'kyc_status' AND e.enumlabel = 'none'
  ) THEN
    ALTER TYPE public.kyc_status RENAME TO kyc_status_privychat_legacy;
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE public.kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PrivyChat enums may exist with a different label set — add Fanbase labels if missing
DO $$
DECLARE
  lbl text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role'
  ) THEN
    FOREACH lbl IN ARRAY ARRAY['fan', 'creator', 'admin', 'moderator'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'user_role' AND e.enumlabel = lbl
      ) THEN
        EXECUTE format('ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS %L', lbl);
      END IF;
    END LOOP;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_status'
  ) THEN
    FOREACH lbl IN ARRAY ARRAY[
      'active', 'suspended', 'banned', 'pending_verification', 'deleted'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'user_status' AND e.enumlabel = lbl
      ) THEN
        EXECUTE format('ALTER TYPE public.user_status ADD VALUE IF NOT EXISTS %L', lbl);
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE
  relkind "char";
BEGIN
  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'profiles';

  IF relkind = 'v' THEN
    EXECUTE 'ALTER VIEW public.profiles RENAME TO profiles_privychat_legacy_view';
  ELSIF relkind = 'm' THEN
    EXECUTE 'ALTER MATERIALIZED VIEW public.profiles RENAME TO profiles_privychat_legacy_matview';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role public.user_role NOT NULL DEFAULT 'fan',
  status public.user_status NOT NULL DEFAULT 'active',
  phone TEXT,
  phone_verified_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  country_code CHAR(2) NOT NULL DEFAULT 'NG',
  locale TEXT NOT NULL DEFAULT 'en-NG',
  -- Use 'pending' here (built into CREATE TYPE). 'none' default is set in migration 05 (PG 55P04).
  kyc_status public.kyc_status NOT NULL DEFAULT 'pending',
  referred_by_code TEXT,
  referral_applied_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  last_seen_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrade legacy TABLE (not view) missing Fanbase columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country_code CHAR(2) DEFAULT 'NG';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en-NG';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_applied_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE profiles SET metadata = '{}' WHERE metadata IS NULL;
UPDATE profiles SET country_code = 'NG' WHERE country_code IS NULL;
UPDATE profiles SET locale = 'en-NG' WHERE locale IS NULL;
UPDATE profiles SET kyc_status = 'pending' WHERE kyc_status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'search_vector'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(username, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(display_name, '')), 'B')
      ) STORED;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_username_format
    CHECK (username ~ '^[a-z0-9_]{3,30}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_phone_e164
    CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{6,14}$');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username_active
  ON profiles (lower(username))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles (role, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles (last_seen_at DESC NULLS LAST)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_search ON profiles USING GIN (search_vector);

COMMENT ON TABLE profiles IS 'Platform users; id matches auth.users';
