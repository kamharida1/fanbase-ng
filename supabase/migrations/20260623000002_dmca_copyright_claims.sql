-- Trust & Safety: DMCA / stolen content takedown flow
-- A copyright_claim tracks the full lifecycle from initial filing through
-- counter-notice or auto-removal after the 14-day window.

CREATE TABLE IF NOT EXISTS copyright_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  -- claimant may be a non-platform user (null for anonymous / external filers)
  claimant_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  description TEXT NOT NULL,
  original_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_counter_notice'
    CHECK (status IN (
      'pending_counter_notice',  -- notified creator; waiting 14 days
      'counter_noticed',         -- creator disputed; admin reviews
      'resolved_removed',        -- post removed (deadline passed or admin action)
      'resolved_dismissed',      -- claim dismissed (false / no merit)
      'escalated'                -- legal referral
    )),
  counter_notice_deadline TIMESTAMPTZ NOT NULL,
  counter_notice_at TIMESTAMPTZ,
  counter_notice_body TEXT,
  resolved_by UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copyright_claims_post ON copyright_claims (post_id);

-- Efficient cron scan for overdue claims
CREATE INDEX IF NOT EXISTS idx_copyright_claims_due
  ON copyright_claims (counter_notice_deadline)
  WHERE status = 'pending_counter_notice';

CREATE TRIGGER copyright_claims_updated_at
  BEFORE UPDATE ON copyright_claims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE copyright_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY copyright_claims_service_role ON copyright_claims
  FOR ALL TO service_role USING (true);

COMMENT ON TABLE copyright_claims IS
  'DMCA / copyright takedown claims against creator posts. '
  'Posts with no counter-notice within counter_notice_deadline are auto-removed by cron.';
