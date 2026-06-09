-- Migration: subscription fraud — card fingerprint tracking
-- Stores Paystack authorization signatures per payer for cross-account card sharing detection.

CREATE TABLE IF NOT EXISTS payment_authorizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature           TEXT        NOT NULL,
  authorization_code  TEXT        NOT NULL,
  last4               CHAR(4),
  bank                TEXT,
  card_type           TEXT,
  payer_id            UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_auth_sig_payer UNIQUE (signature, payer_id)
);

-- Cross-account card sharing query: "how many distinct payers used this card recently?"
CREATE INDEX IF NOT EXISTS idx_payment_auth_signature
  ON payment_authorizations (signature, last_seen_at DESC);

-- Per-payer lookup
CREATE INDEX IF NOT EXISTS idx_payment_auth_payer
  ON payment_authorizations (payer_id);

-- Trigger to auto-update updated_at via the shared set_updated_at function
-- (table has first_seen_at / last_seen_at instead — no updated_at needed)

-- RLS: service_role only; no user-facing reads
ALTER TABLE payment_authorizations ENABLE ROW LEVEL SECURITY;
