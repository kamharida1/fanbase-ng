-- Migration: Paystack payment tracking, refunds, webhook audit fields
-- Fanbase NG

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency_key
  ON payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  paystack_refund_id TEXT NOT NULL,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT payment_refunds_paystack_id_unique UNIQUE (paystack_refund_id)
);

CREATE INDEX idx_payment_refunds_payment ON payment_refunds (payment_id);
CREATE INDEX idx_payment_refunds_status ON payment_refunds (status, created_at DESC);

ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

ALTER TABLE paystack_webhook_events
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS signature_valid BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX idx_paystack_webhook_events_type_created
  ON paystack_webhook_events (event_type, created_at DESC);

COMMENT ON TABLE payment_refunds IS 'Paystack refund events linked to payments';
