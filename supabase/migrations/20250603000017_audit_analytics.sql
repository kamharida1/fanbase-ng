-- Migration: 17 — Audit logs, analytics, sessions
-- Fanbase NG

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_type TEXT NOT NULL,
  admin_user_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action, created_at DESC);

CREATE TABLE IF NOT EXISTS earnings_daily (
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  gross_kobo BIGINT NOT NULL DEFAULT 0,
  platform_fee_kobo BIGINT NOT NULL DEFAULT 0,
  payment_fee_kobo BIGINT NOT NULL DEFAULT 0,
  net_kobo BIGINT NOT NULL DEFAULT 0,
  subscription_kobo BIGINT NOT NULL DEFAULT 0,
  ppv_kobo BIGINT NOT NULL DEFAULT 0,
  tips_kobo BIGINT NOT NULL DEFAULT 0,
  message_ppv_kobo BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (creator_id, date)
);

CREATE INDEX IF NOT EXISTS idx_earnings_daily_date ON earnings_daily (date DESC);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_address INET,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
  ON user_sessions (user_id, last_active_at DESC)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE audit_logs IS 'Immutable audit trail; service role writes only';
