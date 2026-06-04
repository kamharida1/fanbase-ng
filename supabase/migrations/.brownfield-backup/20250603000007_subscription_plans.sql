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

-- Migration: 07 — Subscription plans
-- Fanbase NG

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_kobo BIGINT NOT NULL CHECK (price_kobo > 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  paystack_plan_code TEXT UNIQUE,
  benefits JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trial_days INT NOT NULL DEFAULT 0 CHECK (trial_days >= 0 AND trial_days <= 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_plans_name_len CHECK (char_length(name) BETWEEN 1 AND 80)
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_creator_active
  ON subscription_plans (creator_id, sort_order)
  WHERE is_active = true;

COMMENT ON TABLE subscription_plans IS 'Creator tiers mapped to Paystack Plans';
