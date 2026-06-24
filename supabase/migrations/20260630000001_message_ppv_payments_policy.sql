-- Add an INSERT policy for message-based PPV checkout, mirroring
-- payments_insert_ppv_checkout (post-based PPV) which only validates
-- against post_id/posts — message-based PPV (post_id NULL, message_id set)
-- has no matching policy, so a fan trying to unlock a paid DM has every
-- insert silently rejected by RLS.
CREATE POLICY payments_insert_message_ppv_checkout ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    payer_id = auth.uid()
    AND status = 'pending'
    AND type = 'ppv'
    AND message_id IS NOT NULL
    AND creator_id IS NOT NULL
    AND (metadata->>'purpose') = 'message_ppv_purchase'
    AND (metadata->>'fan_id')::uuid = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = payments.message_id
        AND m.sender_id = payments.creator_id
        AND m.is_ppv = true
        AND m.ppv_price_kobo = payments.amount_kobo
        AND c.fan_id = auth.uid()
        AND c.creator_id = payments.creator_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM message_purchases mp
      WHERE mp.fan_id = auth.uid()
        AND mp.message_id = payments.message_id
    )
  );
