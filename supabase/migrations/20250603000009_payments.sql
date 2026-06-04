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
