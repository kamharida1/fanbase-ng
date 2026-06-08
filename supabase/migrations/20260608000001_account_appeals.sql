-- Migration: Appeal system for suspended/banned accounts
-- Fanbase NG
--
-- Lets users whose account has been suspended or banned submit a written
-- appeal for admin review. Mirrors the disputes workflow: a dedicated table,
-- one open appeal per user, admin resolution that can reinstate the account,
-- and notifications on the outcome.

DO $$ BEGIN
  CREATE TYPE appeal_status AS ENUM ('pending', 'approved', 'denied');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_status';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'appeal_update';

CREATE TABLE IF NOT EXISTS account_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status appeal_status NOT NULL DEFAULT 'pending',
  account_status_at_submission user_status NOT NULL,
  message TEXT NOT NULL,
  admin_notes TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one open appeal per user at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_appeals_pending_per_user
  ON account_appeals (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_account_appeals_status
  ON account_appeals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_appeals_user
  ON account_appeals (user_id, created_at DESC);

ALTER TABLE account_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_appeals_select_own ON account_appeals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY account_appeals_insert_own ON account_appeals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON account_appeals TO authenticated;
