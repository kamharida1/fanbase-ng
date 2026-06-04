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

SELECT public.fanbase_add_column_if_missing('payout_requests', 'status', 'payout_request_status DEFAULT ''pending''');
SELECT public.fanbase_add_column_if_missing('payout_requests', 'fee_kobo', 'BIGINT DEFAULT 0');
SELECT public.fanbase_add_column_if_missing('payout_requests', 'net_amount_kobo', 'BIGINT');
SELECT public.fanbase_add_column_if_missing('payout_requests', 'reviewed_by', 'UUID');
SELECT public.fanbase_add_column_if_missing('payout_requests', 'updated_at', 'TIMESTAMPTZ DEFAULT now()');
SELECT public.fanbase_add_column_if_missing('payout_accounts', 'is_default', 'BOOLEAN DEFAULT false');
SELECT public.fanbase_add_column_if_missing('payout_accounts', 'is_verified', 'BOOLEAN DEFAULT false');

CREATE INDEX IF NOT EXISTS idx_payout_requests_creator_created
  ON payout_requests (creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_requests_pending
  ON payout_requests (created_at)
  WHERE status IN ('pending', 'review');
