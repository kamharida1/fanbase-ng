-- Migration: Secure media uploads (R2 + Stream tracking, virus scan hooks)
-- Fanbase NG

DO $$ BEGIN
  CREATE TYPE media_upload_context AS ENUM ('post', 'message', 'profile');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE media_storage_provider AS ENUM ('r2', 'stream');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE media_upload_status AS ENUM (
    'pending_upload',
    'uploaded',
    'scanning',
    'ready',
    'rejected',
    'failed',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE media_scan_status AS ENUM (
    'pending',
    'clean',
    'infected',
    'skipped',
    'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE media_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  context media_upload_context NOT NULL,
  context_ref_id UUID NOT NULL,
  provider media_storage_provider NOT NULL,
  object_key TEXT,
  stream_uid TEXT,
  mime_type TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  status media_upload_status NOT NULL DEFAULT 'pending_upload',
  scan_status media_scan_status NOT NULL DEFAULT 'pending',
  scan_provider TEXT,
  scan_result JSONB NOT NULL DEFAULT '{}',
  bound_entity_type TEXT,
  bound_entity_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT media_uploads_storage_ref CHECK (
    (provider = 'r2' AND object_key IS NOT NULL)
    OR (provider = 'stream' AND stream_uid IS NOT NULL)
  )
);

CREATE INDEX idx_media_uploads_owner ON media_uploads (owner_id, created_at DESC);
CREATE INDEX idx_media_uploads_context ON media_uploads (context, context_ref_id);
CREATE INDEX idx_media_uploads_pending_expiry
  ON media_uploads (expires_at)
  WHERE status = 'pending_upload';
CREATE INDEX idx_media_uploads_scanning
  ON media_uploads (created_at)
  WHERE status = 'scanning';

CREATE TRIGGER media_uploads_set_updated_at
  BEFORE UPDATE ON media_uploads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE messages
  ADD COLUMN media_upload_id UUID REFERENCES media_uploads(id);

ALTER TABLE post_media
  ADD COLUMN media_upload_id UUID REFERENCES media_uploads(id);

COMMENT ON TABLE media_uploads IS
  'Tracks presigned R2 / Stream uploads, virus scan, and binding to posts/messages/profiles';

-- RLS
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY media_uploads_select_own ON media_uploads
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY media_uploads_insert_own ON media_uploads
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY media_uploads_update_own ON media_uploads
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- Service role manages scan/webhook state (no policy = service bypasses RLS)

GRANT SELECT, INSERT, UPDATE ON media_uploads TO authenticated;
