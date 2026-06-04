-- Migration: Creator wallet ledger functions (credit, clearance, payout reserve)
-- Fanbase NG

CREATE OR REPLACE FUNCTION public.credit_creator_from_payment(
  p_creator_id UUID,
  p_payment_id UUID,
  p_gross_kobo BIGINT,
  p_idempotency_key TEXT,
  p_tx_type wallet_tx_type DEFAULT 'subscription_credit',
  p_platform_fee_bps INT DEFAULT 2000,
  p_payment_fee_bps INT DEFAULT 150,
  p_clearance_days INT DEFAULT 7,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_platform_fee BIGINT;
  v_payment_fee BIGINT;
  v_net BIGINT;
  v_tx_id UUID;
  v_clears_at TIMESTAMPTZ;
  v_today DATE;
BEGIN
  IF p_gross_kobo <= 0 THEN
    RAISE EXCEPTION 'gross amount must be positive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM wallet_transactions wt
    WHERE wt.idempotency_key = p_idempotency_key
    LIMIT 1
  ) THEN
    SELECT wt.id INTO v_tx_id
    FROM wallet_transactions wt
    WHERE wt.idempotency_key = p_idempotency_key
    ORDER BY wt.created_at DESC
    LIMIT 1;
    RETURN v_tx_id;
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE owner_id = p_creator_id AND owner_type = 'creator'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'creator wallet not found';
  END IF;

  v_platform_fee := (p_gross_kobo * p_platform_fee_bps) / 10000;
  v_payment_fee := (p_gross_kobo * p_payment_fee_bps) / 10000;
  v_net := p_gross_kobo - v_platform_fee - v_payment_fee;

  IF v_net <= 0 THEN
    RAISE EXCEPTION 'net earnings must be positive after fees';
  END IF;

  v_clears_at := now() + make_interval(days => p_clearance_days);
  v_today := (now() AT TIME ZONE 'UTC')::date;

  UPDATE wallets
  SET
    pending_kobo = pending_kobo + v_net,
    lifetime_credited_kobo = lifetime_credited_kobo + v_net,
    updated_at = now()
  WHERE id = v_wallet.id;

  v_tx_id := gen_random_uuid();

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
    clears_at,
    created_at
  ) VALUES (
    v_tx_id,
    v_wallet.id,
    p_payment_id,
    v_net,
    v_wallet.available_kobo,
    v_wallet.pending_kobo + v_net,
    p_tx_type,
    COALESCE(p_description, 'Earnings from payment'),
    p_idempotency_key,
    jsonb_build_object(
      'gross_kobo', p_gross_kobo,
      'platform_fee_kobo', v_platform_fee,
      'payment_fee_kobo', v_payment_fee,
      'net_kobo', v_net,
      'cleared', false
    ),
    v_clears_at,
    now()
  );

  INSERT INTO earnings_daily (
    creator_id,
    date,
    gross_kobo,
    platform_fee_kobo,
    payment_fee_kobo,
    net_kobo,
    subscription_kobo
  ) VALUES (
    p_creator_id,
    v_today,
    p_gross_kobo,
    v_platform_fee,
    v_payment_fee,
    v_net,
    CASE WHEN p_tx_type = 'subscription_credit' THEN v_net ELSE 0 END
  )
  ON CONFLICT (creator_id, date) DO UPDATE SET
    gross_kobo = earnings_daily.gross_kobo + EXCLUDED.gross_kobo,
    platform_fee_kobo = earnings_daily.platform_fee_kobo + EXCLUDED.platform_fee_kobo,
    payment_fee_kobo = earnings_daily.payment_fee_kobo + EXCLUDED.payment_fee_kobo,
    net_kobo = earnings_daily.net_kobo + EXCLUDED.net_kobo,
    subscription_kobo = earnings_daily.subscription_kobo + EXCLUDED.subscription_kobo;

  RETURN v_tx_id;
END;
$$;

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

    UPDATE wallets
    SET
      pending_kobo = pending_kobo - r.amount_kobo,
      available_kobo = available_kobo + r.amount_kobo,
      updated_at = now()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;

    UPDATE wallet_transactions
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cleared', true, 'cleared_at', now())
    WHERE id = r.id AND created_at = r.created_at;

    v_clear_tx_id := gen_random_uuid();

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
      v_clear_tx_id,
      v_wallet.id,
      NULL,
      r.amount_kobo,
      v_wallet.available_kobo,
      v_wallet.pending_kobo,
      'clearance_credit',
      'Pending balance cleared',
      'clearance:' || r.id::text,
      jsonb_build_object('source_tx_id', r.id, 'cleared', true),
      now()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

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

  v_remaining := v_orig.amount_kobo;
  v_debit_available := LEAST(v_wallet.available_kobo, v_remaining);
  v_remaining := v_remaining - v_debit_available;
  v_debit_pending := LEAST(v_wallet.pending_kobo, v_remaining);

  UPDATE wallets
  SET
    available_kobo = available_kobo - v_debit_available,
    pending_kobo = pending_kobo - v_debit_pending,
    lifetime_credited_kobo = GREATEST(0, lifetime_credited_kobo - v_orig.amount_kobo),
    updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  v_tx_id := gen_random_uuid();

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
    p_payment_id,
    -v_orig.amount_kobo,
    v_wallet.available_kobo,
    v_wallet.pending_kobo,
    'refund_debit',
    'Refund reversal',
    p_idempotency_key,
    jsonb_build_object(
      'original_tx_id', v_orig.id,
      'debit_available', v_debit_available,
      'debit_pending', v_debit_pending
    ),
    now()
  );

  UPDATE wallet_transactions
  SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('refunded', true)
  WHERE id = v_orig.id AND created_at = v_orig.created_at;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_creator_from_payment FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_wallet_clearances FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_creator_payout_request FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reverse_creator_payment_credit FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.credit_creator_from_payment TO service_role;
GRANT EXECUTE ON FUNCTION public.run_wallet_clearances TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_creator_payment_credit TO service_role;
GRANT EXECUTE ON FUNCTION public.create_creator_payout_request TO authenticated, service_role;
