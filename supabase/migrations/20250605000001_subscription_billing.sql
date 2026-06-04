-- Migration: subscription billing intervals, period-aware access, webhook idempotency
-- Fanbase NG

DO $$ BEGIN
  CREATE TYPE plan_billing_interval AS ENUM ('monthly', 'annual', 'free');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE subscription_plans
  ADD COLUMN billing_interval plan_billing_interval NOT NULL DEFAULT 'monthly';

ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_price_kobo_check;

ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_price_kobo_nonneg CHECK (price_kobo >= 0);

ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_billing_price CHECK (
    (billing_interval = 'free' AND price_kobo = 0)
    OR (billing_interval <> 'free' AND price_kobo > 0)
  );

ALTER TABLE subscriptions
  ADD COLUMN billing_interval plan_billing_interval NOT NULL DEFAULT 'monthly';

COMMENT ON COLUMN subscription_plans.billing_interval IS
  'monthly | annual (Paystack recurring) | free (no payment)';

-- Paystack webhook idempotency (service role writes)
CREATE TABLE paystack_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paystack_webhook_events_event_id_unique UNIQUE (event_id)
);

CREATE INDEX idx_paystack_webhook_events_unprocessed
  ON paystack_webhook_events (created_at)
  WHERE processed_at IS NULL;

ALTER TABLE paystack_webhook_events ENABLE ROW LEVEL SECURITY;

-- Period-aware subscriber check (used by RLS + post gating)
CREATE OR REPLACE FUNCTION public.is_active_subscriber(
  p_fan_id UUID,
  p_creator_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.fan_id = p_fan_id
      AND s.creator_id = p_creator_id
      AND s.status IN ('trialing', 'active', 'past_due')
      AND (
        s.current_period_end IS NULL
        OR s.current_period_end > now()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_post(p_user_id UUID, p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post RECORD;
BEGIN
  SELECT creator_id, visibility, plan_id, status, moderation_status, removed_at
  INTO v_post
  FROM posts
  WHERE id = p_post_id;

  IF NOT FOUND OR v_post.status <> 'published' OR v_post.removed_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF v_post.moderation_status <> 'approved' THEN
    RETURN v_post.creator_id = p_user_id;
  END IF;

  IF v_post.creator_id = p_user_id THEN
    RETURN true;
  END IF;

  IF v_post.visibility = 'public' THEN
    RETURN true;
  END IF;

  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_post.visibility = 'subscribers' THEN
    RETURN public.is_active_subscriber(p_user_id, v_post.creator_id);
  END IF;

  IF v_post.visibility = 'tier' THEN
    RETURN EXISTS (
      SELECT 1
      FROM subscriptions s
      WHERE s.fan_id = p_user_id
        AND s.creator_id = v_post.creator_id
        AND s.plan_id = v_post.plan_id
        AND s.status IN ('trialing', 'active', 'past_due')
        AND (
          s.current_period_end IS NULL
          OR s.current_period_end > now()
        )
    );
  END IF;

  IF v_post.visibility = 'ppv' THEN
    RETURN EXISTS (
      SELECT 1 FROM ppv_purchases pp
      WHERE pp.fan_id = p_user_id AND pp.post_id = p_post_id
    );
  END IF;

  RETURN false;
END;
$$;

-- Fans can start subscription checkout (pending payment rows)
DROP POLICY IF EXISTS payments_insert_subscription_checkout ON payments;
CREATE POLICY payments_insert_subscription_checkout ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    payer_id = auth.uid()
    AND status = 'pending'
    AND type = 'subscription'
  );

CREATE POLICY subscription_events_insert_participant ON subscription_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.id = subscription_events.subscription_id
        AND (s.fan_id = auth.uid() OR s.creator_id = auth.uid())
    )
  );
