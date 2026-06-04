-- Fanbase NG — full schema (DEFER until Increment 5+)
-- For incremental development, run 20250602000000_increment_02_profiles.sql first.
-- Run this migration when you need subscriptions, payments, etc.

-- Enums
CREATE TYPE user_role AS ENUM ('fan', 'creator', 'admin', 'moderator');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned', 'pending_verification');
CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE post_visibility AS ENUM ('public', 'subscribers', 'tier', 'ppv');
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'fan',
  status user_status NOT NULL DEFAULT 'active',
  phone TEXT,
  country_code TEXT NOT NULL DEFAULT 'NG',
  locale TEXT NOT NULL DEFAULT 'en-NG',
  kyc_status kyc_status NOT NULL DEFAULT 'none',
  metadata JSONB NOT NULL DEFAULT '{}',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE creator_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  bio TEXT,
  banner_url TEXT,
  category TEXT[] NOT NULL DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  platform_fee_bps INT,
  payout_enabled BOOLEAN NOT NULL DEFAULT false,
  min_payout_kobo INT NOT NULL DEFAULT 500000,
  social_links JSONB NOT NULL DEFAULT '{}',
  stats_cache JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_kobo INT NOT NULL CHECK (price_kobo > 0),
  paystack_plan_code TEXT,
  benefits JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trial_days INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id),
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id),
  tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
  status subscription_status NOT NULL DEFAULT 'active',
  paystack_subscription_code TEXT UNIQUE,
  paystack_customer_code TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fan_id, creator_id)
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  paystack_reference TEXT UNIQUE NOT NULL,
  paystack_transaction_id TEXT,
  amount_kobo INT NOT NULL CHECK (amount_kobo > 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  type TEXT NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}',
  webhook_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE creator_balances (
  creator_id UUID PRIMARY KEY REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  available_kobo BIGINT NOT NULL DEFAULT 0,
  pending_kobo BIGINT NOT NULL DEFAULT 0,
  lifetime_earned_kobo BIGINT NOT NULL DEFAULT 0,
  lifetime_withdrawn_kobo BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id),
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (subset — expand per architecture doc)
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_subscriptions_creator_status ON subscriptions(creator_id, status);
CREATE INDEX idx_payments_user_created ON payments(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER creator_profiles_updated_at BEFORE UPDATE ON creator_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
