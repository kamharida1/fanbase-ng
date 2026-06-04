-- Idempotent column add for PrivyChat → Fanbase upgrades. Paste or include at top of migrations 07+.
CREATE OR REPLACE FUNCTION public.fanbase_add_column_if_missing(
  p_table text,
  p_column text,
  p_definition text
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = p_column
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN %I %s',
      p_table,
      p_column,
      p_definition
    );
  END IF;
END;
$$;

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

DO $audit_logs_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_type TEXT NOT NULL DEFAULT 'system';
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS admin_user_id UUID;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'unknown';
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'unknown';
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS before_state JSONB;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS after_state JSONB;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address INET;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS request_id TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'user_id'
  ) THEN
    UPDATE public.audit_logs SET actor_id = user_id WHERE actor_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'performed_by'
  ) THEN
    UPDATE public.audit_logs SET actor_id = performed_by WHERE actor_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_audit_logs_actor_created'
  ) THEN
    CREATE INDEX idx_audit_logs_actor_created ON public.audit_logs (actor_id, created_at DESC);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'entity_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_audit_logs_entity'
  ) THEN
    CREATE INDEX idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id, created_at DESC);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'action'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_audit_logs_action'
  ) THEN
    CREATE INDEX idx_audit_logs_action ON public.audit_logs (action, created_at DESC);
  END IF;
END $audit_logs_brownfield$;

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

DO $user_sessions_brownfield$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_sessions'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
  ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS ip_address INET;
  ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT now();
  ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
  ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_sessions' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_user_sessions_user_active'
  ) THEN
    CREATE INDEX idx_user_sessions_user_active
      ON public.user_sessions (user_id, last_active_at DESC)
      WHERE revoked_at IS NULL;
  END IF;
END $user_sessions_brownfield$;

COMMENT ON TABLE audit_logs IS 'Immutable audit trail; service role writes only';
