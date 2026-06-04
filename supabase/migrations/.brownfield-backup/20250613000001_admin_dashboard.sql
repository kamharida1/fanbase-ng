-- Migration: Admin dashboard — stats, moderation queue, payout review
-- Fanbase NG

-- Brownfield: PrivyChat report_status / payout_request_status may omit Fanbase labels.
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'resolved';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'dismissed';
ALTER TYPE payout_request_status ADD VALUE IF NOT EXISTS 'review';
ALTER TYPE payout_request_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE payout_request_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE payout_request_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE payout_request_status ADD VALUE IF NOT EXISTS 'cancelled';

CREATE OR REPLACE FUNCTION public.enqueue_post_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published'
    AND NEW.removed_at IS NULL
    AND NEW.moderation_status = 'pending'
  THEN
    INSERT INTO moderation_queue (
      entity_type,
      entity_id,
      post_id,
      priority_score,
      status
    )
    VALUES (
      'post',
      NEW.id,
      NEW.id,
      CASE WHEN NEW.visibility = 'ppv' THEN 50 WHEN NEW.visibility = 'public' THEN 10 ELSE 30 END,
      'pending'
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET
      status = 'pending',
      priority_score = EXCLUDED.priority_score,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_enqueue_moderation ON posts;
CREATE TRIGGER posts_enqueue_moderation
  AFTER INSERT OR UPDATE OF status, moderation_status ON posts
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_post_moderation();

CREATE OR REPLACE FUNCTION public.admin_get_dashboard_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'users_total', (SELECT COUNT(*)::INT FROM profiles WHERE deleted_at IS NULL),
    'users_active', (
      SELECT COUNT(*)::INT FROM profiles
      WHERE deleted_at IS NULL AND status = 'active'
    ),
    'creators_total', (SELECT COUNT(*)::INT FROM creator_profiles),
    'subscriptions_active', (
      SELECT COUNT(*)::INT FROM subscriptions
      WHERE status IN ('trialing', 'active', 'past_due')
    ),
    'posts_pending_moderation', (
      SELECT COUNT(*)::INT FROM moderation_queue WHERE status = 'pending'
    ),
    'reports_open', (
      SELECT COUNT(*)::INT FROM reports WHERE status IN ('open', 'reviewing')
    ),
    'payouts_pending', (
      SELECT COUNT(*)::INT FROM payout_requests
      WHERE status IN ('pending', 'review')
    ),
    'payments_30d_kobo', (
      SELECT COALESCE(SUM(amount_kobo), 0)::BIGINT
      FROM payments
      WHERE status = 'success' AND created_at > now() - interval '30 days'
    ),
    'payouts_completed_30d_kobo', (
      SELECT COALESCE(SUM(net_amount_kobo), 0)::BIGINT
      FROM payout_requests
      WHERE status = 'completed' AND processed_at > now() - interval '30 days'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_payout_request(
  p_request_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req payout_requests%ROWTYPE;
  v_wallet wallets%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM payout_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout request not found';
  END IF;

  IF v_req.status NOT IN ('pending', 'review') THEN
    RAISE EXCEPTION 'payout cannot be rejected in status %', v_req.status;
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE id = v_req.wallet_id
  FOR UPDATE;

  UPDATE wallets
  SET
    available_kobo = available_kobo + v_req.amount_kobo,
    lifetime_debited_kobo = GREATEST(0, lifetime_debited_kobo - v_req.amount_kobo),
    updated_at = now()
  WHERE id = v_wallet.id;

  UPDATE payout_requests
  SET
    status = 'cancelled',
    failure_reason = COALESCE(p_reason, 'Rejected by admin'),
    reviewed_by = p_admin_user_id,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO wallet_transactions (
    wallet_id,
    amount_kobo,
    balance_available_after_kobo,
    balance_pending_after_kobo,
    type,
    description,
    idempotency_key,
    metadata
  )
  SELECT
    v_wallet.id,
    v_req.amount_kobo,
    w.available_kobo,
    w.pending_kobo,
    'adjustment',
    'Payout rejected — funds returned',
    'payout_reject:' || p_request_id::text,
    jsonb_build_object('payout_request_id', p_request_id)
  FROM wallets w WHERE w.id = v_wallet.id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_payout_request(
  p_request_id UUID,
  p_admin_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM payout_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout request not found';
  END IF;

  IF v_req.status NOT IN ('pending', 'review') THEN
    RAISE EXCEPTION 'payout cannot be approved in status %', v_req.status;
  END IF;

  UPDATE payout_requests
  SET
    status = 'completed',
    reviewed_by = p_admin_user_id,
    reviewed_at = now(),
    processed_at = now(),
    updated_at = now()
  WHERE id = p_request_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reject_payout_request(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_payout_request(UUID, UUID) TO service_role;
