-- Migration: Dispute / chargeback resolution workflow
-- Fanbase NG
--
-- A Paystack chargeback freezes the disputed amount in the creator's wallet
-- (moved into a new `held_kobo` bucket so it cannot be withdrawn) until an
-- admin — or an unambiguous webhook resolution — releases it back or debits
-- it permanently.

-- Extend enums ---------------------------------------------------------------
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'dispute_hold';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'dispute_release';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'dispute_debit';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_dispute';

-- Extend disputes table -------------------------------------------------------
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES creator_profiles(user_id),
  ADD COLUMN IF NOT EXISTS fan_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS evidence_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES admin_users(id),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_disputes_status_created ON disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disputes_creator ON disputes (creator_id)
  WHERE creator_id IS NOT NULL;

-- Held balance on wallets ------------------------------------------------------
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS held_kobo BIGINT NOT NULL DEFAULT 0 CHECK (held_kobo >= 0);

-- Hold creator funds pending dispute resolution --------------------------------
CREATE OR REPLACE FUNCTION public.hold_creator_payment_for_dispute(
  p_creator_id UUID,
  p_payment_id UUID,
  p_dispute_id UUID,
  p_idempotency_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig wallet_transactions%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_remaining BIGINT;
  v_hold_available BIGINT;
  v_hold_pending BIGINT;
  v_tx_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM wallet_transactions wt
    WHERE wt.idempotency_key = p_idempotency_key
    LIMIT 1
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_orig
  FROM wallet_transactions
  WHERE payment_id = p_payment_id
    AND type IN ('subscription_credit', 'ppv_credit', 'tip_credit', 'message_ppv_credit')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE owner_id = p_creator_id AND owner_type = 'creator'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Hold as much of the original net credit as is still in the wallet —
  -- some of it may already be withdrawn, in which case we hold what's left.
  v_remaining := LEAST(v_orig.amount_kobo, v_wallet.available_kobo + v_wallet.pending_kobo);
  v_hold_available := LEAST(v_wallet.available_kobo, v_remaining);
  v_remaining := v_remaining - v_hold_available;
  v_hold_pending := LEAST(v_wallet.pending_kobo, v_remaining);

  IF v_hold_available + v_hold_pending <= 0 THEN
    RETURN false;
  END IF;

  UPDATE wallets
  SET
    available_kobo = available_kobo - v_hold_available,
    pending_kobo = pending_kobo - v_hold_pending,
    held_kobo = held_kobo + v_hold_available + v_hold_pending,
    updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  v_tx_id := gen_random_uuid();

  INSERT INTO wallet_transactions (
    id, wallet_id, payment_id, amount_kobo,
    balance_available_after_kobo, balance_pending_after_kobo,
    type, description, idempotency_key, metadata, created_at
  ) VALUES (
    v_tx_id, v_wallet.id, p_payment_id, -(v_hold_available + v_hold_pending),
    v_wallet.available_kobo, v_wallet.pending_kobo,
    'dispute_hold', 'Funds held pending payment dispute', p_idempotency_key,
    jsonb_build_object(
      'dispute_id', p_dispute_id,
      'original_tx_id', v_orig.id,
      'held_from_available', v_hold_available,
      'held_from_pending', v_hold_pending
    ),
    now()
  );

  RETURN true;
END;
$$;

-- Release a hold back to the creator (dispute won, or withdrawn/closed) --------
CREATE OR REPLACE FUNCTION public.release_dispute_hold(
  p_creator_id UUID,
  p_dispute_id UUID,
  p_idempotency_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold wallet_transactions%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_amount BIGINT;
  v_to_available BIGINT;
  v_to_pending BIGINT;
  v_tx_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM wallet_transactions wt
    WHERE wt.idempotency_key = p_idempotency_key
    LIMIT 1
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_hold
  FROM wallet_transactions
  WHERE type = 'dispute_hold'
    AND (metadata->>'dispute_id')::uuid = p_dispute_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE type IN ('dispute_release', 'dispute_debit')
      AND (metadata->>'dispute_id')::uuid = p_dispute_id
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE owner_id = p_creator_id AND owner_type = 'creator'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_amount := -v_hold.amount_kobo;
  v_to_available := COALESCE((v_hold.metadata->>'held_from_available')::bigint, 0);
  v_to_pending := COALESCE((v_hold.metadata->>'held_from_pending')::bigint, 0);

  UPDATE wallets
  SET
    available_kobo = available_kobo + v_to_available,
    pending_kobo = pending_kobo + v_to_pending,
    held_kobo = GREATEST(0, held_kobo - v_amount),
    updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  v_tx_id := gen_random_uuid();

  INSERT INTO wallet_transactions (
    id, wallet_id, payment_id, amount_kobo,
    balance_available_after_kobo, balance_pending_after_kobo,
    type, description, idempotency_key, metadata, created_at
  ) VALUES (
    v_tx_id, v_wallet.id, v_hold.payment_id, v_amount,
    v_wallet.available_kobo, v_wallet.pending_kobo,
    'dispute_release', 'Dispute resolved — held funds released', p_idempotency_key,
    jsonb_build_object('dispute_id', p_dispute_id, 'hold_tx_id', v_hold.id),
    now()
  );

  RETURN true;
END;
$$;

-- Permanently debit held funds (dispute lost / chargeback upheld) --------------
CREATE OR REPLACE FUNCTION public.finalize_dispute_loss(
  p_creator_id UUID,
  p_dispute_id UUID,
  p_idempotency_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold wallet_transactions%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_amount BIGINT;
  v_tx_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM wallet_transactions wt
    WHERE wt.idempotency_key = p_idempotency_key
    LIMIT 1
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_hold
  FROM wallet_transactions
  WHERE type = 'dispute_hold'
    AND (metadata->>'dispute_id')::uuid = p_dispute_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM wallet_transactions
    WHERE type IN ('dispute_release', 'dispute_debit')
      AND (metadata->>'dispute_id')::uuid = p_dispute_id
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE owner_id = p_creator_id AND owner_type = 'creator'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_amount := -v_hold.amount_kobo;

  UPDATE wallets
  SET
    held_kobo = GREATEST(0, held_kobo - v_amount),
    lifetime_credited_kobo = GREATEST(0, lifetime_credited_kobo - v_amount),
    updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  v_tx_id := gen_random_uuid();

  INSERT INTO wallet_transactions (
    id, wallet_id, payment_id, amount_kobo,
    balance_available_after_kobo, balance_pending_after_kobo,
    type, description, idempotency_key, metadata, created_at
  ) VALUES (
    v_tx_id, v_wallet.id, v_hold.payment_id, -v_amount,
    v_wallet.available_kobo, v_wallet.pending_kobo,
    'dispute_debit', 'Dispute lost — held funds permanently deducted', p_idempotency_key,
    jsonb_build_object('dispute_id', p_dispute_id, 'hold_tx_id', v_hold.id),
    now()
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.hold_creator_payment_for_dispute FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_dispute_hold FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_dispute_loss FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.hold_creator_payment_for_dispute TO service_role;
GRANT EXECUTE ON FUNCTION public.release_dispute_hold TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_dispute_loss TO service_role;
