-- Idempotent column add for PrivyChat → Fanbase upgrades. Paste or include at top of migrations 07+.
CREATE OR REPLACE FUNCTION public.fanbase_add_column_if_missing(
  p_table text,
  p_column text,
  p_definition text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN %I %s',
      p_table,
      p_column,
      p_definition
    );
  END IF;
END;
$$;

-- Migration: 16 — Referral system
-- Fanbase NG

CREATE TABLE IF NOT EXISTS referral_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  referrer_reward_bps INT NOT NULL DEFAULT 500 CHECK (referrer_reward_bps BETWEEN 0 AND 10000),
  referee_discount_bps INT NOT NULL DEFAULT 0 CHECK (referee_discount_bps BETWEEN 0 AND 10000),
  max_rewards_per_referrer INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_programs_active ON referral_programs (slug)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  uses_count INT NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  max_uses INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_code_format CHECK (code ~ '^[A-Z0-9]{4,16}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_codes_code ON referral_codes (upper(code));

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes (owner_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES referral_programs(id),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status referral_status NOT NULL DEFAULT 'pending',
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_referrals_referee UNIQUE (referee_id)
);

DO $referrals_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'referrals'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS program_id UUID;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referral_code_id UUID;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referrer_id UUID;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS referee_id UUID;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS status referral_status NOT NULL DEFAULT 'pending';
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS rewarded_at TIMESTAMPTZ;
  ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'referred_user_id'
  ) THEN
    UPDATE public.referrals SET referee_id = referred_user_id WHERE referee_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'referred_id'
  ) THEN
    UPDATE public.referrals SET referee_id = referred_id WHERE referee_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'invitee_id'
  ) THEN
    UPDATE public.referrals SET referee_id = invitee_id WHERE referee_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'referrer_user_id'
  ) THEN
    UPDATE public.referrals SET referrer_id = referrer_user_id WHERE referrer_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'referrer_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'status'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_referrals_referrer_status'
  ) THEN
    CREATE INDEX idx_referrals_referrer_status ON public.referrals (referrer_id, status);
  END IF;
END $referrals_brownfield$;

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  wallet_transaction_id UUID,
  wallet_transaction_created_at TIMESTAMPTZ,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral ON referral_rewards (referral_id);
