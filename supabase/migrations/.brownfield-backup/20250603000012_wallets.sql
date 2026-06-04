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

DO $wallets_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallets'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS owner_id UUID;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS owner_type wallet_owner_type NOT NULL DEFAULT 'fan';
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS available_kobo BIGINT NOT NULL DEFAULT 0;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS pending_kobo BIGINT NOT NULL DEFAULT 0;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS lifetime_credited_kobo BIGINT NOT NULL DEFAULT 0;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS lifetime_debited_kobo BIGINT NOT NULL DEFAULT 0;
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'NGN';
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'user_id'
  ) THEN
    UPDATE public.wallets SET owner_id = user_id WHERE owner_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'creator_id'
  ) THEN
    UPDATE public.wallets SET owner_id = creator_id WHERE owner_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'owner_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'owner_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_wallets_creator_available'
  ) THEN
    CREATE INDEX idx_wallets_creator_available
      ON public.wallets (owner_id, available_kobo DESC)
      WHERE owner_type = 'creator';
  END IF;
END $wallets_brownfield$;

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

DO $wallet_tx_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS wallet_id UUID;
  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS payment_id UUID;
  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS amount_kobo BIGINT;
  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_available_after_kobo BIGINT;
  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS balance_pending_after_kobo BIGINT;
  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS type wallet_tx_type;
  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS clears_at TIMESTAMPTZ;
  ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_wallet_tx_wallet_created'
  ) THEN
    CREATE INDEX idx_wallet_tx_wallet_created
      ON public.wallet_transactions (wallet_id, created_at DESC);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'payment_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_wallet_tx_payment'
  ) THEN
    CREATE INDEX idx_wallet_tx_payment ON public.wallet_transactions (payment_id)
      WHERE payment_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallet_transactions' AND column_name = 'clears_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_wallet_tx_clears_at'
  ) THEN
    CREATE INDEX idx_wallet_tx_clears_at ON public.wallet_transactions (clears_at)
      WHERE clears_at IS NOT NULL;
  END IF;
END $wallet_tx_brownfield$;

COMMENT ON TABLE wallet_transactions IS 'Append-only ledger; writes via service role only';
