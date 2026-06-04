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

-- Migration: 09 — Payments & disputes
-- Fanbase NG

CREATE TABLE IF NOT EXISTS payments (
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

SELECT public.fanbase_add_column_if_missing('payments', 'payer_id', 'UUID');
SELECT public.fanbase_add_column_if_missing('payments', 'creator_id', 'UUID');
SELECT public.fanbase_add_column_if_missing('payments', 'subscription_id', 'UUID');
SELECT public.fanbase_add_column_if_missing('payments', 'post_id', 'UUID');
SELECT public.fanbase_add_column_if_missing('payments', 'message_id', 'UUID');
SELECT public.fanbase_add_column_if_missing('payments', 'updated_at', 'TIMESTAMPTZ DEFAULT now()');
SELECT public.fanbase_add_column_if_missing('payments', 'type', 'payment_type DEFAULT ''subscription''');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'UPDATE public.payments SET payer_id = user_id WHERE payer_id IS NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_payer_created ON payments (payer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_creator_created ON payments (creator_id, created_at DESC)
  WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_pending ON payments (created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS disputes (
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

CREATE INDEX IF NOT EXISTS idx_disputes_payment ON disputes (payment_id);
