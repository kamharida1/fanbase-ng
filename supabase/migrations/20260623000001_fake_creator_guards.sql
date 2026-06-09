-- Trust & Safety: Fake creator payout hold window
-- Tracks when the first subscriber payment clears so the 14-day payout hold
-- can be enforced in application code without an extra payments join.

ALTER TABLE creator_profiles
  ADD COLUMN IF NOT EXISTS first_subscriber_paid_at TIMESTAMPTZ;

COMMENT ON COLUMN creator_profiles.first_subscriber_paid_at IS
  'Timestamp of the creator''s first successful subscriber payment. '
  'Payout withdrawals are held for 14 days from this timestamp (one-time). '
  'NULL until the first subscription payment clears.';

CREATE INDEX IF NOT EXISTS idx_creator_profiles_first_paid
  ON creator_profiles (first_subscriber_paid_at)
  WHERE first_subscriber_paid_at IS NOT NULL;
