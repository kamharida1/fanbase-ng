-- ─────────────────────────────────────────────────────────────────────────────
-- Content moderation: CSAM hash registry + automated scan tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- Registry of known-bad file hashes (SHA-256 of raw file bytes).
-- Populated from: NCMEC hash sets, StopNCII, internal takedowns, admin imports.
-- Service-role only — clients must never be able to read this table.
CREATE TABLE IF NOT EXISTS content_violation_hashes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256_hex text        NOT NULL,
  category   text        NOT NULL
             CHECK (category IN ('csam', 'ncii', 'violence', 'spam', 'other')),
  severity   text        NOT NULL DEFAULT 'critical'
             CHECK (severity IN ('critical', 'high', 'medium')),
  source     text        NOT NULL DEFAULT 'manual'
             CHECK (source IN ('ncmec', 'stopncii', 'internal', 'manual')),
  added_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_content_violation_hashes_sha256
  ON content_violation_hashes (sha256_hex);

ALTER TABLE content_violation_hashes ENABLE ROW LEVEL SECURITY;

-- Hash registry is service-role only — no client access, ever.
CREATE POLICY cvh_service_role_only ON content_violation_hashes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Add content scan tracking columns to media_uploads
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE media_uploads
  ADD COLUMN IF NOT EXISTS content_scan_status text NOT NULL DEFAULT 'pending'
    CHECK (content_scan_status IN ('pending','clean','flagged','blocked','skipped','error')),
  ADD COLUMN IF NOT EXISTS content_scan_action  text
    CHECK (content_scan_action IN ('allow','review','block') OR content_scan_action IS NULL),
  ADD COLUMN IF NOT EXISTS content_scan_labels  jsonb        NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS content_scan_sha256  text,
  ADD COLUMN IF NOT EXISTS content_scan_completed_at timestamptz;

-- Fast lookup for admin moderation queue: all flagged/blocked uploads
CREATE INDEX IF NOT EXISTS idx_media_uploads_content_scan_action
  ON media_uploads (content_scan_action, created_at DESC)
  WHERE content_scan_action IN ('review', 'block');
