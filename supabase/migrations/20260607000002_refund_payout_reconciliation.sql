-- Migration: Refund/dispute vs payout reconciliation — creator debt tracking
-- Fanbase NG
--
-- Problem: a refund or lost dispute can require reversing more than a
-- creator's current available+pending wallet balance, because they already
-- withdrew the earnings. Previously that shortfall was silently absorbed —
-- the platform ate the loss with no record and no recovery path.
--
-- Fix: any shortfall is now recorded as `wallets.debt_kobo` (an amount the
-- creator owes back). Debt is automatically recovered from the creator's
-- future cleared earnings before those earnings become withdrawable
-- (`run_wallet_clearances`), and withdrawals are blocked while debt remains
-- outstanding (`create_creator_payout_request`).

ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'debt_incurred';
ALTER TYPE wallet_tx_type ADD VALUE IF NOT EXISTS 'debt_recovered';

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS debt_kobo BIGINT NOT NULL DEFAULT 0 CHECK (debt_kobo >= 0);

CREATE INDEX IF NOT EXISTS idx_wallets_creator_debt
  ON wallets (owner_id, debt_kobo DESC)
  WHERE owner_type = 'creator' AND debt_kobo > 0;

-- Reverse a creator's credit for a payment (refund). Any portion that can't
-- be covered by the current available+pending balance becomes debt.
CREATE OR REPLACE FUNCTION public.reverse_creator_payment_credit(
  p_creator_id UUID,
  p_payment_id UUID,
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
  v_debit_available BIGINT;
  v_debit_pending BIGINT;
  v_shortfall BIGINT;
  v_tx_id UUID;
  v_debt_tx_id UUID;
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

  v_remaining := v_orig.amount_kobo;
  v_debit_available := LEAST(v_wallet.available_kobo, v_remaining);
  v_remaining := v_remaining - v_debit_available;
  v_debit_pending := LEAST(v_wallet.pending_kobo, v_remaining);
  v_shortfall := v_remaining - v_debit_pending;

  UPDATE wallets
  SET
    available_kobo = available_kobo - v_debit_available,
    pending_kobo = pending_kobo - v_debit_pending,
    debt_kobo = debt_kobo + v_shortfall,
    lifetime_credited_kobo = GREATEST(0, lifetime_credited_kobo - v_orig.amount_kobo),
    updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  v_tx_id := gen_random_uuid();

  INSERT INTO wallet_transactions (
    id, wallet_id, payment_id, amount_kobo,
    balance_available_after_kobo, balance_pending_after_kobo,
    type, description, idempotency_key, metadata, created_at
  ) VALUES (
    v_tx_id, v_wallet.id, p_payment_id, -v_orig.amount_kobo,
    v_wallet.available_kobo, v_wallet.pending_kobo,
    'refund_debit', 'Refund reversal', p_idempotency_key,
    jsonb_build_object(
      'original_tx_id', v_orig.id,
      'debit_available', v_debit_available,
      'debit_pending', v_debit_pending,
      'shortfall', v_shortfall
    ),
    now()
  );

  UPDATE wallet_transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('refunded', true)
  WHERE id = v_orig.id AND created_at = v_orig.created_at;

  IF v_shortfall > 0 THEN
    v_debt_tx_id := gen_random_uuid();
    INSERT INTO wallet_transactions (
      id, wallet_id, payment_id, amount_kobo,
      balance_available_after_kobo, balance_pending_after_kobo,
      type, description, idempotency_key, metadata, created_at
    ) VALUES (
      v_debt_tx_id, v_wallet.id, p_payment_id, v_shortfall,
      v_wallet.available_kobo, v_wallet.pending_kobo,
      'debt_incurred',
      'Refund exceeded wallet balance — added to outstanding balance',
      p_idempotency_key || ':debt',
      jsonb_build_object(
        'reason', 'refund',
        'reversal_tx_id', v_tx_id,
        'debt_after_kobo', v_wallet.debt_kobo
      ),
      now()
    );
  END IF;

  RETURN true;
END;
$$;

-- Permanently debit held funds (dispute lost / chargeback upheld). Any part
-- of the original credit that wasn't held (because it had already cleared
-- and been withdrawn before the dispute was opened) becomes debt too.
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
  v_orig wallet_transactions%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_held_amount BIGINT;
  v_original_amount BIGINT;
  v_shortfall BIGINT;
  v_tx_id UUID;
  v_debt_tx_id UUID;
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

  v_held_amount := -v_hold.amount_kobo;

  SELECT * INTO v_orig
  FROM wallet_transactions
  WHERE id = (v_hold.metadata->>'original_tx_id')::uuid
  LIMIT 1;

  v_original_amount := COALESCE(v_orig.amount_kobo, v_held_amount);
  v_shortfall := GREATEST(0, v_original_amount - v_held_amount);

  UPDATE wallets
  SET
    held_kobo = GREATEST(0, held_kobo - v_held_amount),
    debt_kobo = debt_kobo + v_shortfall,
    lifetime_credited_kobo = GREATEST(0, lifetime_credited_kobo - v_held_amount - v_shortfall),
    updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  v_tx_id := gen_random_uuid();

  INSERT INTO wallet_transactions (
    id, wallet_id, payment_id, amount_kobo,
    balance_available_after_kobo, balance_pending_after_kobo,
    type, description, idempotency_key, metadata, created_at
  ) VALUES (
    v_tx_id, v_wallet.id, v_hold.payment_id, -v_held_amount,
    v_wallet.available_kobo, v_wallet.pending_kobo,
    'dispute_debit', 'Dispute lost — held funds permanently deducted', p_idempotency_key,
    jsonb_build_object(
      'dispute_id', p_dispute_id,
      'hold_tx_id', v_hold.id,
      'shortfall', v_shortfall
    ),
    now()
  );

  IF v_shortfall > 0 THEN
    v_debt_tx_id := gen_random_uuid();
    INSERT INTO wallet_transactions (
      id, wallet_id, payment_id, amount_kobo,
      balance_available_after_kobo, balance_pending_after_kobo,
      type, description, idempotency_key, metadata, created_at
    ) VALUES (
      v_debt_tx_id, v_wallet.id, v_hold.payment_id, v_shortfall,
      v_wallet.available_kobo, v_wallet.pending_kobo,
      'debt_incurred',
      'Lost dispute exceeded held balance — added to outstanding balance',
      p_idempotency_key || ':debt',
      jsonb_build_object(
        'reason', 'dispute',
        'dispute_id', p_dispute_id,
        'debt_after_kobo', v_wallet.debt_kobo
      ),
      now()
    );
  END IF;

  RETURN true;
END;
$$;

-- Clearances now pay down outstanding debt first, before adding to available.
CREATE OR REPLACE FUNCTION public.run_wallet_clearances()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_wallet wallets%ROWTYPE;
  v_count INT := 0;
  v_clear_tx_id UUID;
  v_debt_tx_id UUID;
  v_to_debt BIGINT;
  v_to_available BIGINT;
BEGIN
  FOR r IN
    SELECT wt.id, wt.wallet_id, wt.created_at, wt.amount_kobo, wt.metadata
    FROM wallet_transactions wt
    WHERE wt.clears_at IS NOT NULL
      AND wt.clears_at <= now()
      AND COALESCE(wt.metadata->>'cleared', 'false') <> 'true'
      AND wt.type IN (
        'subscription_credit',
        'ppv_credit',
        'tip_credit',
        'message_ppv_credit',
        'referral_credit'
      )
      AND wt.amount_kobo > 0
    ORDER BY wt.clears_at ASC
  LOOP
    SELECT * INTO v_wallet
    FROM wallets
    WHERE id = r.wallet_id
    FOR UPDATE;

    IF v_wallet.pending_kobo < r.amount_kobo THEN
      CONTINUE;
    END IF;

    v_to_debt := LEAST(v_wallet.debt_kobo, r.amount_kobo);
    v_to_available := r.amount_kobo - v_to_debt;

    UPDATE wallets
    SET
      pending_kobo = pending_kobo - r.amount_kobo,
      available_kobo = available_kobo + v_to_available,
      debt_kobo = debt_kobo - v_to_debt,
      updated_at = now()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    UPDATE wallet_transactions
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cleared', true, 'cleared_at', now())
    WHERE id = r.id AND created_at = r.created_at;

    IF v_to_available > 0 THEN
      v_clear_tx_id := gen_random_uuid();

      INSERT INTO wallet_transactions (
        id, wallet_id, payment_id, amount_kobo,
        balance_available_after_kobo, balance_pending_after_kobo,
        type, description, idempotency_key, metadata, created_at
      ) VALUES (
        v_clear_tx_id, v_wallet.id, NULL, v_to_available,
        v_wallet.available_kobo, v_wallet.pending_kobo,
        'clearance_credit', 'Pending balance cleared', 'clearance:' || r.id::text,
        jsonb_build_object(
          'source_tx_id', r.id,
          'cleared', true,
          'gross_kobo', r.amount_kobo,
          'applied_to_debt_kobo', v_to_debt
        ),
        now()
      );
    END IF;

    IF v_to_debt > 0 THEN
      v_debt_tx_id := gen_random_uuid();

      INSERT INTO wallet_transactions (
        id, wallet_id, payment_id, amount_kobo,
        balance_available_after_kobo, balance_pending_after_kobo,
        type, description, idempotency_key, metadata, created_at
      ) VALUES (
        v_debt_tx_id, v_wallet.id, NULL, -v_to_debt,
        v_wallet.available_kobo, v_wallet.pending_kobo,
        'debt_recovered', 'Cleared earnings applied to outstanding balance',
        'clearance:' || r.id::text || ':debt',
        jsonb_build_object('source_tx_id', r.id, 'debt_after_kobo', v_wallet.debt_kobo),
        now()
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Block withdrawals while the creator has an outstanding balance owed back.
CREATE OR REPLACE FUNCTION public.create_creator_payout_request(
  p_creator_id UUID,
  p_amount_kobo BIGINT,
  p_payout_account_id UUID,
  p_fee_kobo BIGINT DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_account payout_accounts%ROWTYPE;
  v_net BIGINT;
  v_request_id UUID;
  v_tx_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_creator_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_amount_kobo <= 0 THEN
    RAISE EXCEPTION 'withdrawal amount must be positive';
  END IF;

  IF p_fee_kobo < 0 OR p_amount_kobo <= p_fee_kobo THEN
    RAISE EXCEPTION 'invalid fee';
  END IF;

  v_net := p_amount_kobo - p_fee_kobo;

  SELECT * INTO v_account
  FROM payout_accounts
  WHERE id = p_payout_account_id AND creator_id = p_creator_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payout account not found';
  END IF;

  IF NOT v_account.is_verified THEN
    RAISE EXCEPTION 'payout account is not verified';
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE owner_id = p_creator_id AND owner_type = 'creator'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator wallet not found';
  END IF;

  IF v_wallet.debt_kobo > 0 THEN
    RAISE EXCEPTION 'You have an outstanding balance from refunds or disputes that must clear before you can withdraw';
  END IF;

  IF v_wallet.available_kobo < p_amount_kobo THEN
    RAISE EXCEPTION 'insufficient available balance';
  END IF;

  IF EXISTS (
    SELECT 1 FROM payout_requests pr
    WHERE pr.creator_id = p_creator_id
      AND pr.status IN ('pending', 'review', 'processing')
  ) THEN
    RAISE EXCEPTION 'you already have a withdrawal in progress';
  END IF;

  UPDATE wallets
  SET
    available_kobo = available_kobo - p_amount_kobo,
    lifetime_debited_kobo = lifetime_debited_kobo + p_amount_kobo,
    updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  v_request_id := gen_random_uuid();
  v_tx_id := gen_random_uuid();

  INSERT INTO payout_requests (
    id,
    creator_id,
    wallet_id,
    payout_account_id,
    amount_kobo,
    fee_kobo,
    net_amount_kobo,
    status
  ) VALUES (
    v_request_id,
    p_creator_id,
    v_wallet.id,
    p_payout_account_id,
    p_amount_kobo,
    p_fee_kobo,
    v_net,
    'pending'
  );

  INSERT INTO wallet_transactions (
    id,
    wallet_id,
    payment_id,
    amount_kobo,
    balance_available_after_kobo,
    balance_pending_after_kobo,
    type,
    description,
    idempotency_key,
    metadata,
    created_at
  ) VALUES (
    v_tx_id,
    v_wallet.id,
    NULL,
    -p_amount_kobo,
    v_wallet.available_kobo,
    v_wallet.pending_kobo,
    'payout_debit',
    'Withdrawal request',
    'payout:' || v_request_id::text,
    jsonb_build_object('payout_request_id', v_request_id),
    now()
  );

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_creator_payment_credit FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_dispute_loss FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_wallet_clearances FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_creator_payout_request FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reverse_creator_payment_credit TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_dispute_loss TO service_role;
GRANT EXECUTE ON FUNCTION public.run_wallet_clearances TO service_role;
GRANT EXECUTE ON FUNCTION public.create_creator_payout_request TO authenticated, service_role;
