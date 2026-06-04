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

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status ON referrals (referrer_id, status);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  wallet_transaction_id UUID,
  wallet_transaction_created_at TIMESTAMPTZ,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral ON referral_rewards (referral_id);
