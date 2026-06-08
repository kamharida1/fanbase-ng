-- payment_refunds: allow payers and receiving creators to read their own refund records.
-- The table has RLS enabled but no policies, making it service-role-only.
-- Fans who receive refunds need to be able to check refund status.
CREATE POLICY payment_refunds_select_participant ON payment_refunds
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM payments p
      WHERE p.id = payment_refunds.payment_id
        AND (p.payer_id = auth.uid() OR p.creator_id = auth.uid())
    )
  );

-- Atomic referral code usage counter increment.
-- Avoids a read-then-write race condition in the application layer.
CREATE OR REPLACE FUNCTION increment_referral_code_uses(p_code_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE referral_codes SET uses_count = uses_count + 1 WHERE id = p_code_id;
$$;
