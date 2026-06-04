-- =============================================================================
-- Fanbase NG — Production PostgreSQL Schema (Supabase)
-- =============================================================================
-- Target: 1M+ users, millions of messages/transactions/audit rows
--
-- Fresh project: run this file once in Supabase SQL Editor (or supabase db push).
-- Incremental dev (profiles only): use 20250602000000_increment_02_profiles.sql first,
-- then do NOT run this file — use incremental migrations instead.
--
-- Money: BIGINT kobo (1 NGN = 100 kobo). Timestamps: TIMESTAMPTZ (UTC).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('fan', 'creator', 'admin', 'moderator');
CREATE TYPE user_status AS ENUM (
  'active', 'suspended', 'banned', 'pending_verification', 'deleted'
);
CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected');
CREATE TYPE subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'cancelled', 'expired'
);
CREATE TYPE post_visibility AS ENUM ('public', 'subscribers', 'tier', 'ppv');
CREATE TYPE post_status AS ENUM (
  'draft', 'processing', 'published', 'archived', 'removed'
);
CREATE TYPE post_media_type AS ENUM ('image', 'video', 'audio', 'document');
CREATE TYPE media_processing_status AS ENUM (
  'uploading', 'processing', 'ready', 'failed'
);
CREATE TYPE moderation_status AS ENUM (
  'pending', 'approved', 'flagged', 'rejected'
);
CREATE TYPE payment_status AS ENUM (
  'pending', 'success', 'failed', 'refunded', 'disputed'
);
CREATE TYPE payment_type AS ENUM (
  'subscription', 'ppv', 'tip', 'message_ppv', 'wallet_topup', 'referral_bonus'
);
CREATE TYPE wallet_owner_type AS ENUM ('fan', 'creator');
CREATE TYPE wallet_tx_type AS ENUM (
  'subscription_credit',
  'ppv_credit',
  'tip_credit',
  'message_ppv_credit',
  'platform_fee_debit',
  'payment_fee_debit',
  'refund_debit',
  'payout_debit',
  'clearance_credit',
  'referral_credit',
  'adjustment_credit',
  'adjustment_debit',
  'topup_credit'
);
CREATE TYPE payout_account_type AS ENUM ('bank_account', 'mobile_money');
CREATE TYPE payout_request_status AS ENUM (
  'pending', 'review', 'processing', 'completed', 'failed', 'cancelled'
);
CREATE TYPE report_reason AS ENUM (
  'spam',
  'harassment',
  'underage',
  'illegal',
  'copyright',
  'impersonation',
  'other'
);
CREATE TYPE report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE moderation_action_type AS ENUM (
  'approve', 'reject', 'remove', 'warn', 'strike', 'ban', 'restore'
);
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'push', 'sms');
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed', 'read');
CREATE TYPE referral_status AS ENUM ('pending', 'qualified', 'rewarded', 'expired', 'rejected');
CREATE TYPE dispute_status AS ENUM ('open', 'won', 'lost', 'closed');

-- -----------------------------------------------------------------------------
-- Utility functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_username TEXT;
  base_username TEXT;
  final_username TEXT;
BEGIN
  requested_username := lower(trim(NEW.raw_user_meta_data->>'username'));
  base_username := lower(
    regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '', 'g')
  );

  IF requested_username IS NOT NULL AND length(requested_username) >= 3 THEN
    final_username := requested_username;
  ELSIF length(base_username) >= 3 THEN
    final_username := base_username;
  ELSE
    final_username := 'user';
  END IF;

  final_username := final_username || substr(replace(NEW.id::text, '-', ''), 1, 6);

  INSERT INTO public.profiles (id, username, display_name, referred_by_code)
  VALUES (
    NEW.id,
    final_username,
    coalesce(
      nullif(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    nullif(trim(NEW.raw_user_meta_data->>'referral_code'), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Monthly partition helper (call via cron for high-volume tables)
CREATE OR REPLACE FUNCTION public.ensure_monthly_partition(
  parent_regclass TEXT,
  partition_date DATE DEFAULT (date_trunc('month', now()))::date
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  parent_schema TEXT;
  parent_name TEXT;
  partition_name TEXT;
  range_start DATE;
  range_end DATE;
BEGIN
  parent_schema := split_part(parent_regclass::text, '.', 1);
  parent_name := split_part(parent_regclass::text, '.', 2);
  IF parent_name = '' THEN
    parent_name := parent_schema;
    parent_schema := 'public';
  END IF;

  range_start := date_trunc('month', partition_date)::date;
  range_end := (range_start + interval '1 month')::date;
  partition_name := format('%s_%s', parent_name, to_char(range_start, 'YYYY_MM'));

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I FOR VALUES FROM (%L) TO (%L)',
    parent_schema,
    partition_name,
    parent_schema,
    parent_name,
    range_start,
    range_end
  );

  RETURN partition_name;
END;
$$;

-- -----------------------------------------------------------------------------
-- Users & creators
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
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

CREATE UNIQUE INDEX uq_profiles_username_active
  ON profiles (lower(username))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_profiles_role_status ON profiles (role, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_profiles_last_seen ON profiles (last_seen_at DESC NULLS LAST)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX idx_profiles_search ON profiles USING GIN (search_vector);

CREATE TABLE creator_profiles (
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

CREATE INDEX idx_creator_profiles_verified ON creator_profiles (is_verified)
  WHERE is_accepting_subscribers = true;

CREATE INDEX idx_creator_profiles_category ON creator_profiles USING GIN (category);

-- -----------------------------------------------------------------------------
-- Admin (separate from fan/creator Supabase Auth in production)
-- -----------------------------------------------------------------------------
CREATE TABLE admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_roles_slug_format CHECK (slug ~ '^[a-z0-9_]+$')
);

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES admin_roles(id),
  profile_id UUID REFERENCES profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_users_role ON admin_users (role_id) WHERE is_active = true;

-- Seed system roles
INSERT INTO admin_roles (slug, name, description, permissions, is_system) VALUES
  ('super_admin', 'Super Admin', 'Full platform access', '["*"]', true),
  ('admin', 'Admin', 'Operations and finance', '["users","creators","payouts","reports","moderation"]', true),
  ('moderator', 'Moderator', 'Content moderation only', '["moderation","reports"]', true);

-- -----------------------------------------------------------------------------
-- Subscription plans & subscriptions
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_kobo BIGINT NOT NULL CHECK (price_kobo > 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  paystack_plan_code TEXT UNIQUE,
  benefits JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trial_days INT NOT NULL DEFAULT 0 CHECK (trial_days >= 0 AND trial_days <= 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);

CREATE INDEX idx_subscription_plans_creator_active
  ON subscription_plans (creator_id, sort_order)
  WHERE is_active = true;

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'active',
  paystack_subscription_code TEXT UNIQUE,
  paystack_customer_code TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active-like subscription per fan/creator pair
CREATE UNIQUE INDEX uq_subscriptions_fan_creator_active
  ON subscriptions (fan_id, creator_id)
  WHERE status IN ('trialing', 'active', 'past_due');

CREATE INDEX idx_subscriptions_fan_status
  ON subscriptions (fan_id, status, current_period_end DESC);

CREATE INDEX idx_subscriptions_creator_status
  ON subscriptions (creator_id, status);

CREATE INDEX idx_subscriptions_renewal
  ON subscriptions (current_period_end)
  WHERE status = 'active';

CREATE INDEX idx_subscriptions_paystack
  ON subscriptions (paystack_subscription_code)
  WHERE paystack_subscription_code IS NOT NULL;

CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_sub_created
  ON subscription_events (subscription_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Payments
-- -----------------------------------------------------------------------------
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id UUID NOT NULL REFERENCES profiles(id),
  paystack_reference TEXT NOT NULL,
  paystack_transaction_id TEXT,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  type payment_type NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  creator_id UUID REFERENCES creator_profiles(user_id),
  subscription_id UUID REFERENCES subscriptions(id),
  post_id UUID,
  message_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  webhook_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payments_paystack_reference_unique UNIQUE (paystack_reference)
);

CREATE INDEX idx_payments_payer_created ON payments (payer_id, created_at DESC);
CREATE INDEX idx_payments_status_created ON payments (status, created_at DESC);
CREATE INDEX idx_payments_creator_created ON payments (creator_id, created_at DESC)
  WHERE creator_id IS NOT NULL;
CREATE INDEX idx_payments_pending ON payments (created_at)
  WHERE status = 'pending';

-- -----------------------------------------------------------------------------
-- Posts & media
-- -----------------------------------------------------------------------------
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  caption TEXT,
  visibility post_visibility NOT NULL DEFAULT 'subscribers',
  plan_id UUID REFERENCES subscription_plans(id),
  ppv_price_kobo BIGINT CHECK (ppv_price_kobo IS NULL OR ppv_price_kobo > 0),
  status post_status NOT NULL DEFAULT 'draft',
  moderation_status moderation_status NOT NULL DEFAULT 'pending',
  published_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  stats_cache JSONB NOT NULL DEFAULT '{}',
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(caption, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT posts_ppv_visibility CHECK (
    (visibility = 'ppv' AND ppv_price_kobo IS NOT NULL)
    OR (visibility <> 'ppv')
  ),
  CONSTRAINT posts_tier_visibility CHECK (
    (visibility = 'tier' AND plan_id IS NOT NULL)
    OR (visibility <> 'tier')
  )
);

CREATE INDEX idx_posts_creator_published
  ON posts (creator_id, published_at DESC NULLS LAST)
  WHERE status = 'published' AND removed_at IS NULL;

CREATE INDEX idx_posts_moderation_queue
  ON posts (created_at)
  WHERE moderation_status = 'pending' AND status <> 'removed';

CREATE INDEX idx_posts_search ON posts USING GIN (search_vector);

CREATE TABLE post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_type post_media_type NOT NULL,
  r2_key TEXT,
  stream_uid TEXT,
  thumbnail_url TEXT,
  duration_seconds INT CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  byte_size BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
  sort_order INT NOT NULL DEFAULT 0,
  processing_status media_processing_status NOT NULL DEFAULT 'uploading',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_media_storage_ref CHECK (
    r2_key IS NOT NULL OR stream_uid IS NOT NULL
  )
);

CREATE INDEX idx_post_media_post_order ON post_media (post_id, sort_order);

CREATE TABLE post_likes (
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (fan_id, post_id)
);

CREATE INDEX idx_post_likes_post ON post_likes (post_id, created_at DESC);

CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_body_len CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE INDEX idx_post_comments_post_created
  ON post_comments (post_id, created_at DESC)
  WHERE is_deleted = false;

-- High-volume: partitioned post views
CREATE TABLE post_views (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  viewer_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_post_views_post_created ON post_views (post_id, created_at DESC);

CREATE TABLE ppv_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_ppv_purchases_fan_post UNIQUE (fan_id, post_id)
);

CREATE TABLE tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tips_creator_created ON tips (creator_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Messaging
-- -----------------------------------------------------------------------------
CREATE TABLE conversations (
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

CREATE INDEX idx_conversations_creator_inbox
  ON conversations (creator_id, last_message_at DESC NULLS LAST);

CREATE INDEX idx_conversations_fan_inbox
  ON conversations (fan_id, last_message_at DESC NULLS LAST);

-- High-volume: partitioned messages
CREATE TABLE messages (
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

CREATE INDEX idx_messages_conversation_created
  ON messages (conversation_id, created_at DESC);

CREATE TABLE message_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  message_created_at TIMESTAMPTZ NOT NULL,
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_message_purchases_fan_message UNIQUE (fan_id, message_id, message_created_at)
);

-- -----------------------------------------------------------------------------
-- Wallets & transactions (ledger)
-- -----------------------------------------------------------------------------
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_type wallet_owner_type NOT NULL,
  available_kobo BIGINT NOT NULL DEFAULT 0 CHECK (available_kobo >= 0),
  pending_kobo BIGINT NOT NULL DEFAULT 0 CHECK (pending_kobo >= 0),
  lifetime_credited_kobo BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_credited_kobo >= 0),
  lifetime_debited_kobo BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_debited_kobo >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_wallets_owner UNIQUE (owner_id, owner_type)
);

CREATE INDEX idx_wallets_creator_available
  ON wallets (owner_id, available_kobo DESC)
  WHERE owner_type = 'creator';

-- Append-only ledger, partitioned by month
CREATE TABLE wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,
  payment_id UUID,
  amount_kobo BIGINT NOT NULL,
  balance_available_after_kobo BIGINT NOT NULL,
  balance_pending_after_kobo BIGINT NOT NULL,
  type wallet_tx_type NOT NULL,
  description TEXT,
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  clears_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at),
  CONSTRAINT wallet_tx_idempotency UNIQUE (idempotency_key, created_at),
  CONSTRAINT wallet_tx_amount_nonzero CHECK (amount_kobo <> 0)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_wallet_tx_wallet_created
  ON wallet_transactions (wallet_id, created_at DESC);

CREATE INDEX idx_wallet_tx_payment ON wallet_transactions (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX idx_wallet_tx_clears_at ON wallet_transactions (clears_at)
  WHERE clears_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Payouts
-- -----------------------------------------------------------------------------
CREATE TABLE payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  type payout_account_type NOT NULL,
  bank_code TEXT,
  bank_name TEXT,
  account_number_encrypted TEXT NOT NULL,
  account_number_last4 CHAR(4) NOT NULL,
  account_name TEXT NOT NULL,
  paystack_recipient_code TEXT UNIQUE,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_payout_accounts_creator_default
  ON payout_accounts (creator_id)
  WHERE is_default = true;

CREATE INDEX idx_payout_accounts_creator ON payout_accounts (creator_id);

CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  payout_account_id UUID NOT NULL REFERENCES payout_accounts(id),
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  fee_kobo BIGINT NOT NULL DEFAULT 0 CHECK (fee_kobo >= 0),
  net_amount_kobo BIGINT NOT NULL CHECK (net_amount_kobo > 0),
  status payout_request_status NOT NULL DEFAULT 'pending',
  paystack_transfer_code TEXT UNIQUE,
  failure_reason TEXT,
  reviewed_by UUID REFERENCES admin_users(id),
  reviewed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payout_requests_net_amount CHECK (net_amount_kobo = amount_kobo - fee_kobo)
);

CREATE INDEX idx_payout_requests_creator_created
  ON payout_requests (creator_id, created_at DESC);

CREATE INDEX idx_payout_requests_pending
  ON payout_requests (created_at)
  WHERE status IN ('pending', 'review');

-- -----------------------------------------------------------------------------
-- Notifications (partitioned)
-- -----------------------------------------------------------------------------
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  channel notification_channel NOT NULL DEFAULT 'in_app',
  status notification_status NOT NULL DEFAULT 'pending',
  action_url TEXT,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_pending_send
  ON notifications (created_at)
  WHERE status = 'pending' AND channel <> 'in_app';

-- -----------------------------------------------------------------------------
-- Reports & content moderation
-- -----------------------------------------------------------------------------
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  message_id UUID,
  message_created_at TIMESTAMPTZ,
  reason report_reason NOT NULL,
  details TEXT,
  status report_status NOT NULL DEFAULT 'open',
  resolved_by UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reports_target_present CHECK (
    reported_user_id IS NOT NULL
    OR post_id IS NOT NULL
    OR message_id IS NOT NULL
  )
);

CREATE INDEX idx_reports_open_created ON reports (created_at DESC)
  WHERE status = 'open';

CREATE INDEX idx_reports_reported_user ON reports (reported_user_id)
  WHERE reported_user_id IS NOT NULL;

CREATE TABLE moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  priority_score INT NOT NULL DEFAULT 0,
  flags JSONB NOT NULL DEFAULT '{}',
  assigned_to UUID REFERENCES admin_users(id),
  status moderation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_moderation_queue_entity UNIQUE (entity_type, entity_id)
);

CREATE INDEX idx_moderation_queue_pending
  ON moderation_queue (priority_score DESC, created_at)
  WHERE status = 'pending';

CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES moderation_queue(id) ON DELETE SET NULL,
  moderator_id UUID NOT NULL REFERENCES admin_users(id),
  action moderation_action_type NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_actions_entity
  ON moderation_actions (entity_type, entity_id, created_at DESC);

CREATE TABLE user_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL REFERENCES admin_users(id),
  action_id UUID REFERENCES moderation_actions(id),
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_strikes_user_active
  ON user_strikes (user_id, expires_at)
  WHERE expires_at > now();

-- -----------------------------------------------------------------------------
-- Referral system
-- -----------------------------------------------------------------------------
CREATE TABLE referral_programs (
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

CREATE TABLE referral_codes (
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

CREATE UNIQUE INDEX uq_referral_codes_code ON referral_codes (upper(code));

CREATE INDEX idx_referral_codes_owner ON referral_codes (owner_id) WHERE is_active = true;

CREATE TABLE referrals (
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

CREATE INDEX idx_referrals_referrer_status ON referrals (referrer_id, status);

CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  wallet_transaction_id UUID,
  wallet_transaction_created_at TIMESTAMPTZ,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Audit logs (partitioned), disputes, analytics rollups
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_type TEXT NOT NULL,
  admin_user_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_audit_logs_actor_created ON audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs (action, created_at DESC);
-- BRIN for time-range scans at very large scale (complements monthly partitions)
CREATE INDEX idx_audit_logs_created_brin ON audit_logs USING BRIN (created_at);
CREATE INDEX idx_wallet_tx_created_brin ON wallet_transactions USING BRIN (created_at);
CREATE INDEX idx_messages_created_brin ON messages USING BRIN (created_at);

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  paystack_dispute_id TEXT UNIQUE,
  status dispute_status NOT NULL DEFAULT 'open',
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  reason TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE earnings_daily (
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  gross_kobo BIGINT NOT NULL DEFAULT 0,
  platform_fee_kobo BIGINT NOT NULL DEFAULT 0,
  payment_fee_kobo BIGINT NOT NULL DEFAULT 0,
  net_kobo BIGINT NOT NULL DEFAULT 0,
  subscription_kobo BIGINT NOT NULL DEFAULT 0,
  ppv_kobo BIGINT NOT NULL DEFAULT 0,
  tips_kobo BIGINT NOT NULL DEFAULT 0,
  message_ppv_kobo BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (creator_id, date)
);

CREATE INDEX idx_earnings_daily_date ON earnings_daily (date DESC);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_address INET,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_active
  ON user_sessions (user_id, last_active_at DESC)
  WHERE revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- Deferred FKs on partitioned / cross-table references
-- -----------------------------------------------------------------------------
ALTER TABLE payments
  ADD CONSTRAINT payments_post_fk
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL;

ALTER TABLE post_views
  ADD CONSTRAINT post_views_post_fk
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

ALTER TABLE post_views
  ADD CONSTRAINT post_views_viewer_fk
  FOREIGN KEY (viewer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE messages
  ADD CONSTRAINT messages_conversation_fk
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE messages
  ADD CONSTRAINT messages_sender_fk
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_tx_wallet_fk
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_tx_payment_fk
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_fk
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- Initial partitions (current month + next 2 months)
-- -----------------------------------------------------------------------------
SELECT public.ensure_monthly_partition('public.messages');
SELECT public.ensure_monthly_partition('public.messages', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.messages', (date_trunc('month', now()) + interval '2 months')::date);

SELECT public.ensure_monthly_partition('public.wallet_transactions');
SELECT public.ensure_monthly_partition('public.wallet_transactions', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.wallet_transactions', (date_trunc('month', now()) + interval '2 months')::date);

SELECT public.ensure_monthly_partition('public.notifications');
SELECT public.ensure_monthly_partition('public.notifications', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.notifications', (date_trunc('month', now()) + interval '2 months')::date);

SELECT public.ensure_monthly_partition('public.audit_logs');
SELECT public.ensure_monthly_partition('public.audit_logs', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.audit_logs', (date_trunc('month', now()) + interval '2 months')::date);

SELECT public.ensure_monthly_partition('public.post_views');
SELECT public.ensure_monthly_partition('public.post_views', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.post_views', (date_trunc('month', now()) + interval '2 months')::date);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER creator_profiles_set_updated_at
  BEFORE UPDATE ON creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER subscription_plans_set_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER wallets_set_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payout_accounts_set_updated_at
  BEFORE UPDATE ON payout_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payout_requests_set_updated_at
  BEFORE UPDATE ON payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER reports_set_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER admin_roles_set_updated_at
  BEFORE UPDATE ON admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER admin_users_set_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create creator wallet on creator profile insert
CREATE OR REPLACE FUNCTION public.create_creator_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO wallets (owner_id, owner_type)
  VALUES (NEW.user_id, 'creator')
  ON CONFLICT (owner_id, owner_type) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER creator_profiles_create_wallet
  AFTER INSERT ON creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_creator_wallet();

-- -----------------------------------------------------------------------------
-- Comments (documentation in DB)
-- -----------------------------------------------------------------------------
COMMENT ON TABLE profiles IS 'Platform users; id matches auth.users';
COMMENT ON TABLE creator_profiles IS 'Creator-specific profile; 1:1 with profiles where role=creator';
COMMENT ON TABLE subscription_plans IS 'Creator-defined subscription tiers (Paystack plan mapped)';
COMMENT ON TABLE wallets IS 'Balances per owner; creators accrue earnings, fans may top up';
COMMENT ON TABLE wallet_transactions IS 'Append-only ledger; partitioned monthly at scale';
COMMENT ON TABLE payout_requests IS 'Withdrawal requests to Nigerian bank accounts via Paystack';
COMMENT ON TABLE audit_logs IS 'Immutable audit trail; partitioned monthly';
COMMENT ON TABLE referrals IS 'One row per referred user (referee)';
