-- Migration: security hardening (payments RLS, notification URLs, ppv insert lockdown)

DROP POLICY IF EXISTS payments_insert_ppv_checkout ON payments;
CREATE POLICY payments_insert_ppv_checkout ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    payer_id = auth.uid()
    AND status = 'pending'
    AND type = 'ppv'
    AND post_id IS NOT NULL
    AND creator_id IS NOT NULL
    AND (metadata->>'purpose') = 'ppv_purchase'
    AND (metadata->>'fan_id')::uuid = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM posts p
      WHERE p.id = payments.post_id
        AND p.creator_id = payments.creator_id
        AND p.visibility = 'ppv'
        AND p.ppv_price_kobo = payments.amount_kobo
        AND p.moderation_status = 'approved'
        AND p.status = 'published'
        AND p.removed_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM ppv_purchases pp
      WHERE pp.fan_id = auth.uid()
        AND pp.post_id = payments.post_id
    )
  );

DROP POLICY IF EXISTS payments_insert_subscription_checkout ON payments;
CREATE POLICY payments_insert_subscription_checkout ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    payer_id = auth.uid()
    AND status = 'pending'
    AND type = 'subscription'
    AND creator_id IS NOT NULL
    AND (metadata->>'purpose') = 'subscription_checkout'
    AND (metadata->>'fan_id')::uuid = auth.uid()
    AND (metadata->>'plan_id') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM subscription_plans sp
      WHERE sp.id = (payments.metadata->>'plan_id')::uuid
        AND sp.creator_id = payments.creator_id
        AND sp.is_active = true
        AND sp.price_kobo = payments.amount_kobo
        AND sp.currency = payments.currency
    )
  );

REVOKE INSERT ON ppv_purchases FROM authenticated;
REVOKE INSERT ON ppv_purchases FROM anon;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type notification_type,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_created TIMESTAMPTZ := now();
  v_existing UUID;
  v_action_url TEXT := p_action_url;
BEGIN
  IF v_action_url IS NOT NULL THEN
    IF v_action_url ~* '^\s*(javascript|data|vbscript):'
      OR v_action_url ~* '^\s*//'
    THEN
      v_action_url := NULL;
    END IF;
  END IF;

  IF NOT public.notification_type_enabled(p_user_id, p_type) THEN
    RETURN NULL;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT n.id INTO v_existing
    FROM notifications n
    WHERE n.user_id = p_user_id
      AND n.metadata ->> 'idempotency_key' = p_idempotency_key
      AND n.created_at > now() - interval '30 days'
    ORDER BY n.created_at DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  INSERT INTO notifications (
    id,
    user_id,
    type,
    title,
    body,
    channel,
    status,
    action_url,
    entity_type,
    entity_id,
    metadata,
    sent_at,
    created_at
  )
  VALUES (
    v_id,
    p_user_id,
    p_type::TEXT,
    p_title,
    p_body,
    'in_app',
    'sent',
    v_action_url,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
      || CASE
        WHEN p_idempotency_key IS NOT NULL
        THEN jsonb_build_object('idempotency_key', p_idempotency_key)
        ELSE '{}'::jsonb
      END,
    v_created,
    v_created
  );

  RETURN v_id;
END;
$$;
