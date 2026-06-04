-- Migration: 15 — Reports & moderation
-- Fanbase NG

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  message_id UUID,
  message_created_at TIMESTAMPTZ,
  reason report_reason NOT NULL,
  details TEXT,
  status report_status NOT NULL DEFAULT 'open',
  resolved_by UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reports_target_present CHECK (
    reported_user_id IS NOT NULL OR post_id IS NOT NULL OR message_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_reports_open_created ON reports (created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports (reported_user_id)
  WHERE reported_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  priority_score INT NOT NULL DEFAULT 0,
  flags JSONB NOT NULL DEFAULT '{}',
  assigned_to UUID REFERENCES admin_users(id),
  status moderation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_moderation_queue_entity UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_moderation_queue_pending
  ON moderation_queue (priority_score DESC, created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID REFERENCES moderation_queue(id) ON DELETE SET NULL,
  moderator_id UUID NOT NULL REFERENCES admin_users(id),
  action moderation_action_type NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_entity
  ON moderation_actions (entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL REFERENCES admin_users(id),
  action_id UUID REFERENCES moderation_actions(id),
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cannot use WHERE expires_at > now(): now() is not IMMUTABLE (42P17).
-- Queries for active strikes use: WHERE user_id = $1 AND expires_at > now()
CREATE INDEX IF NOT EXISTS idx_user_strikes_user_expires
  ON user_strikes (user_id, expires_at DESC);
