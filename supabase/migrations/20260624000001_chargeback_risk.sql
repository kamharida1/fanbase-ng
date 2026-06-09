-- Trust & Safety: Chargeback fraud risk tracking
-- Tracks how many chargebacks a fan has lost. After CHARGEBACK_SUSPEND_THRESHOLD
-- losses (enforced in application code), their payment capability is suspended.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS chargeback_loss_count INT NOT NULL DEFAULT 0
    CHECK (chargeback_loss_count >= 0),
  ADD COLUMN IF NOT EXISTS payment_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_suspended_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.chargeback_loss_count IS
  'Number of chargebacks this user has lost (fan perspective). '
  'Incremented when a dispute resolves as "lost" for the creator / fan wins.';

COMMENT ON COLUMN profiles.payment_suspended IS
  'When true, the user may not initiate new subscription payments or PPV purchases. '
  'Set automatically after chargeback_loss_count reaches the threshold (currently 2).';

CREATE INDEX IF NOT EXISTS idx_profiles_payment_suspended ON profiles (id)
  WHERE payment_suspended = true;

-- Extend disputes with compiled evidence snapshot
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS evidence_compiled_at TIMESTAMPTZ;

COMMENT ON COLUMN disputes.evidence_compiled_at IS
  'Timestamp when evidence was automatically compiled into disputes.metadata.evidence. '
  'NULL until the evidence job has run.';
