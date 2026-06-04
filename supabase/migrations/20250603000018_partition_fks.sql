-- Migration: 18 — Foreign keys on partitioned tables & initial partitions
-- Fanbase NG

ALTER TABLE post_views
  ADD CONSTRAINT post_views_post_fk
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

ALTER TABLE post_views
  ADD CONSTRAINT post_views_viewer_fk
  FOREIGN KEY (viewer_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE messages
  ADD CONSTRAINT messages_conversation_fk
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

ALTER TABLE messages
  ADD CONSTRAINT messages_sender_fk
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_tx_wallet_fk
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_tx_payment_fk
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_fk
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Initial partitions: current month + 2 ahead
SELECT public.ensure_monthly_partition('public.messages');
SELECT public.ensure_monthly_partition('public.messages', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.messages', (date_trunc('month', now()) + interval '2 months')::date);

SELECT public.ensure_monthly_partition('public.wallet_transactions');
SELECT public.ensure_monthly_partition('public.wallet_transactions', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.wallet_transactions', (date_trunc('month', now()) + interval '2 months')::date);

SELECT public.ensure_monthly_partition('public.notifications');
SELECT public.ensure_monthly_partition('public.notifications', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.notifications', (date_trunc('month', now()) + interval '2 months')::date);

SELECT public.ensure_monthly_partition('public.audit_logs');
SELECT public.ensure_monthly_partition('public.audit_logs', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.audit_logs', (date_trunc('month', now()) + interval '2 months')::date);

SELECT public.ensure_monthly_partition('public.post_views');
SELECT public.ensure_monthly_partition('public.post_views', (date_trunc('month', now()) + interval '1 month')::date);
SELECT public.ensure_monthly_partition('public.post_views', (date_trunc('month', now()) + interval '2 months')::date);
