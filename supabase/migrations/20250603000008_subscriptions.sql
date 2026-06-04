-- Migration: 08 — Subscriptions & events
-- Fanbase NG

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fan_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status subscription_status NOT NULL DEFAULT 'active',
  paystack_subscription_code TEXT UNIQUE,
  paystack_customer_code TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_fan_creator_active
  ON subscriptions (fan_id, creator_id)
  WHERE status IN ('trialing', 'active', 'past_due');

CREATE INDEX IF NOT EXISTS idx_subscriptions_fan_status
  ON subscriptions (fan_id, status, current_period_end DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_status
  ON subscriptions (creator_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal
  ON subscriptions (current_period_end)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscriptions_paystack
  ON subscriptions (paystack_subscription_code)
  WHERE paystack_subscription_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_sub_created
  ON subscription_events (subscription_id, created_at DESC);
