-- Migration: 12 — Wallets & transactions
-- Fanbase NG

CREATE TABLE IF NOT EXISTS wallets (
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

CREATE INDEX IF NOT EXISTS idx_wallets_creator_available
  ON wallets (owner_id, available_kobo DESC)
  WHERE owner_type = 'creator';

CREATE TABLE IF NOT EXISTS wallet_transactions (
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

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_created
  ON wallet_transactions (wallet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_payment ON wallet_transactions (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_tx_clears_at ON wallet_transactions (clears_at)
  WHERE clears_at IS NOT NULL;

COMMENT ON TABLE wallet_transactions IS 'Append-only ledger; writes via service role only';
