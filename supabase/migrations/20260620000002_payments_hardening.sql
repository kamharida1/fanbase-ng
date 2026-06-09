-- Migration: payments hardening
-- Adds 'abandoned' to payment_status enum for expired checkout sessions,
-- and credit_wallet_on_payout_failure RPC for failed transfer reversals.

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'abandoned';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Adds credit_wallet_on_payout_failure RPC called by the transfer.failed
-- and transfer.reversed webhook handlers to atomically reverse a failed payout.

CREATE OR REPLACE FUNCTION credit_wallet_on_payout_failure(
  p_wallet_id         UUID,
  p_amount_kobo       BIGINT,
  p_payout_request_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_idem   TEXT := 'payout_reversal:' || p_payout_request_id;
BEGIN
  -- Idempotency: skip if already reversed
  IF EXISTS (
    SELECT 1 FROM wallet_transactions WHERE idempotency_key = v_idem
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE id = p_wallet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet not found: %', p_wallet_id;
  END IF;

  UPDATE wallets
  SET
    available_kobo = available_kobo + p_amount_kobo,
    updated_at     = now()
  WHERE id = p_wallet_id
  RETURNING * INTO v_wallet;

  INSERT INTO wallet_transactions (
    wallet_id,
    amount_kobo,
    balance_available_after_kobo,
    balance_pending_after_kobo,
    type,
    description,
    idempotency_key,
    metadata
  ) VALUES (
    p_wallet_id,
    p_amount_kobo,
    v_wallet.available_kobo,
    v_wallet.pending_kobo,
    'adjustment_credit',
    'Payout reversal — transfer failed',
    v_idem,
    jsonb_build_object('payout_request_id', p_payout_request_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION credit_wallet_on_payout_failure(UUID, BIGINT, UUID)
  TO service_role;
