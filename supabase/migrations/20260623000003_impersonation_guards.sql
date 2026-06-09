-- Trust & Safety: Creator impersonation guards
-- reserved_handles blocks exact normalized usernames from being claimed.
-- The fuzzy similarity check (Levenshtein distance) is enforced in application code.

CREATE TABLE IF NOT EXISTS reserved_handles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL,
  normalized_handle TEXT NOT NULL,
  reason TEXT,
  reserved_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reserved_handles_normalized
  ON reserved_handles (normalized_handle);

-- Publicly readable so the check works without service_role;
-- writes are restricted to service_role only.
ALTER TABLE reserved_handles ENABLE ROW LEVEL SECURITY;

CREATE POLICY reserved_handles_select ON reserved_handles
  FOR SELECT USING (true);

CREATE POLICY reserved_handles_write ON reserved_handles
  FOR ALL TO service_role USING (true);

COMMENT ON TABLE reserved_handles IS
  'Admin-managed list of protected usernames that cannot be claimed by any user. '
  'normalized_handle stores the lowercased, leet-normalized form used for matching.';

-- Seed with platform-brand handles that could be used to impersonate the platform
INSERT INTO reserved_handles (handle, normalized_handle, reason) VALUES
  ('fanbaseng',       'fanbaseng',       'Platform brand'),
  ('fanbase',         'fanbase',         'Platform brand'),
  ('fanbaseofficial', 'fanbaseofficial', 'Platform brand'),
  ('fanbase_official','fanbaseofficial', 'Platform brand'),
  ('fanbase_support', 'fanbasesupport',  'Platform brand'),
  ('support',         'support',         'Platform brand'),
  ('admin',           'admin',           'Platform brand'),
  ('moderator',       'moderator',       'Platform brand'),
  ('helpdesk',        'helpdesk',        'Platform brand'),
  ('official',        'official',        'Generic impersonation risk')
ON CONFLICT (normalized_handle) DO NOTHING;
