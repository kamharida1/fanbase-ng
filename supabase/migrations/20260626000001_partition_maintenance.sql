-- Migration: partition maintenance
--
-- Problem: The initial migration (20250603000018) only created 3 monthly
-- partitions (+0, +1, +2 months from run date). There is no recurring job
-- to create future partitions. Inserts into messages, wallet_transactions,
-- notifications, audit_logs, and post_views will hard-fail on the first day
-- of month +3 with "no partition of relation found for row".
--
-- Fix:
--   Part 1 — Extend existing partitions 6 months ahead from now (safe to
--             re-run: ensure_monthly_partition uses CREATE TABLE IF NOT EXISTS).
--   Part 2 — Schedule a pg_cron job that runs on the 1st of every month and
--             creates the partition for 2 months ahead, maintaining a rolling
--             3-month buffer at all times.
--
-- Requires pg_cron extension (Supabase Pro plan). The schedule block is
-- wrapped in a DO/EXCEPTION so the migration succeeds on free-tier instances
-- while logging a NOTICE about the missing cron job.

-- ─── Part 1: Extend partitions to +6 months ahead ────────────────────────────

SELECT public.ensure_monthly_partition('public.messages',
  (date_trunc('month', now()) + interval '3 months')::date);
SELECT public.ensure_monthly_partition('public.messages',
  (date_trunc('month', now()) + interval '4 months')::date);
SELECT public.ensure_monthly_partition('public.messages',
  (date_trunc('month', now()) + interval '5 months')::date);
SELECT public.ensure_monthly_partition('public.messages',
  (date_trunc('month', now()) + interval '6 months')::date);

SELECT public.ensure_monthly_partition('public.wallet_transactions',
  (date_trunc('month', now()) + interval '3 months')::date);
SELECT public.ensure_monthly_partition('public.wallet_transactions',
  (date_trunc('month', now()) + interval '4 months')::date);
SELECT public.ensure_monthly_partition('public.wallet_transactions',
  (date_trunc('month', now()) + interval '5 months')::date);
SELECT public.ensure_monthly_partition('public.wallet_transactions',
  (date_trunc('month', now()) + interval '6 months')::date);

SELECT public.ensure_monthly_partition('public.notifications',
  (date_trunc('month', now()) + interval '3 months')::date);
SELECT public.ensure_monthly_partition('public.notifications',
  (date_trunc('month', now()) + interval '4 months')::date);
SELECT public.ensure_monthly_partition('public.notifications',
  (date_trunc('month', now()) + interval '5 months')::date);
SELECT public.ensure_monthly_partition('public.notifications',
  (date_trunc('month', now()) + interval '6 months')::date);

SELECT public.ensure_monthly_partition('public.audit_logs',
  (date_trunc('month', now()) + interval '3 months')::date);
SELECT public.ensure_monthly_partition('public.audit_logs',
  (date_trunc('month', now()) + interval '4 months')::date);
SELECT public.ensure_monthly_partition('public.audit_logs',
  (date_trunc('month', now()) + interval '5 months')::date);
SELECT public.ensure_monthly_partition('public.audit_logs',
  (date_trunc('month', now()) + interval '6 months')::date);

SELECT public.ensure_monthly_partition('public.post_views',
  (date_trunc('month', now()) + interval '3 months')::date);
SELECT public.ensure_monthly_partition('public.post_views',
  (date_trunc('month', now()) + interval '4 months')::date);
SELECT public.ensure_monthly_partition('public.post_views',
  (date_trunc('month', now()) + interval '5 months')::date);
SELECT public.ensure_monthly_partition('public.post_views',
  (date_trunc('month', now()) + interval '6 months')::date);

-- ─── Part 2: Schedule pg_cron job ────────────────────────────────────────────
-- Runs at 02:00 on the 1st of every month.
-- Creates the partition for 2 months ahead, maintaining a rolling buffer.
-- Example: fires 2026-08-01 → creates partitions for 2026-10-01.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not available (Supabase Pro plan required). '
    'Partition maintenance cron job was NOT scheduled. '
    'Manually run ensure_monthly_partition for each table before month +3 expires, '
    'or upgrade your Supabase plan and re-run this migration.';
END;
$$;

DO $$
BEGIN
  -- Remove any previous version of this job so re-running the migration is safe.
  PERFORM cron.unschedule('fanbase-partition-maintenance');
EXCEPTION WHEN OTHERS THEN
  NULL; -- cron.unschedule raises if the job does not exist; that is fine.
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'fanbase-partition-maintenance',
    '0 2 1 * *',
    $cron_body$
      SELECT public.ensure_monthly_partition('public.messages',
        (date_trunc('month', now()) + interval '2 months')::date);
      SELECT public.ensure_monthly_partition('public.wallet_transactions',
        (date_trunc('month', now()) + interval '2 months')::date);
      SELECT public.ensure_monthly_partition('public.notifications',
        (date_trunc('month', now()) + interval '2 months')::date);
      SELECT public.ensure_monthly_partition('public.audit_logs',
        (date_trunc('month', now()) + interval '2 months')::date);
      SELECT public.ensure_monthly_partition('public.post_views',
        (date_trunc('month', now()) + interval '2 months')::date);
    $cron_body$
  );
  RAISE NOTICE 'pg_cron job "fanbase-partition-maintenance" scheduled (2 AM on the 1st of each month).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule pg_cron job: %. Partition maintenance must be run manually.', SQLERRM;
END;
$$;
