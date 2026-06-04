-- Migration: 13 — Payout accounts & requests
-- Fanbase NG

CREATE TABLE IF NOT EXISTS payout_accounts (
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_accounts_creator_default
  ON payout_accounts (creator_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_payout_accounts_creator ON payout_accounts (creator_id);

CREATE TABLE IF NOT EXISTS payout_requests (
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

CREATE INDEX IF NOT EXISTS idx_payout_requests_creator_created
  ON payout_requests (creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_requests_pending
  ON payout_requests (created_at)
  WHERE status IN ('pending', 'review');
