-- Migration: 18 — Foreign keys on partitioned tables & initial partitions
-- Fanbase NG
-- Brownfield: legacy tables may be non-partitioned; FKs and partitions are best-effort.

-- Refresh partition helper (migration 03 may already be applied on PrivyChat DBs).
CREATE OR REPLACE FUNCTION public.ensure_monthly_partition(
  parent_regclass TEXT,
  partition_date DATE DEFAULT (date_trunc('month', now()))::date
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_schema TEXT;
  parent_name TEXT;
  partition_name TEXT;
  range_start DATE;
  range_end DATE;
BEGIN
  parent_schema := split_part(parent_regclass, '.', 1);
  parent_name := split_part(parent_regclass, '.', 2);
  IF parent_name = '' THEN
    parent_name := parent_schema;
    parent_schema := 'public';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = parent_schema
      AND c.relname = parent_name
      AND c.relkind = 'p'
  ) THEN
    RETURN NULL;
  END IF;

  range_start := date_trunc('month', partition_date)::date;
  range_end := (range_start + interval '1 month')::date;
  partition_name := format('%s_%s', parent_name, to_char(range_start, 'YYYY_MM'));

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I FOR VALUES FROM (%L) TO (%L)',
    parent_schema,
    partition_name,
    parent_schema,
    parent_name,
    range_start,
    range_end
  );

  RETURN partition_name;
END;
$$;

DO $partition_fks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_views_post_fk') THEN
    ALTER TABLE public.post_views
      ADD CONSTRAINT post_views_post_fk
      FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_views_viewer_fk') THEN
    ALTER TABLE public.post_views
      ADD CONSTRAINT post_views_viewer_fk
      FOREIGN KEY (viewer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_fk') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_conversation_fk
      FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_fk') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_sender_fk
      FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_tx_wallet_fk') THEN
    ALTER TABLE public.wallet_transactions
      ADD CONSTRAINT wallet_tx_wallet_fk
      FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_tx_payment_fk') THEN
    ALTER TABLE public.wallet_transactions
      ADD CONSTRAINT wallet_tx_payment_fk
      FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_fk') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_fk
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_column THEN
    NULL;
END $partition_fks$;

-- Initial partitions: current month + 2 ahead (no-op when parent is not partitioned)
DO $ensure_partitions$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'messages',
    'wallet_transactions',
    'notifications',
    'audit_logs',
    'post_views'
  ];
  off INT;
  month_start DATE;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR off IN 0..2 LOOP
      month_start := (date_trunc('month', now()) + off * interval '1 month')::date;
      PERFORM public.ensure_monthly_partition('public.' || t, month_start);
    END LOOP;
  END LOOP;
END $ensure_partitions$;
