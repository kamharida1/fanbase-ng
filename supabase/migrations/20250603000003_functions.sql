-- Migration: 03 — Functions (utilities, auth, RLS helpers, partitions)
-- Fanbase NG

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auth: create profile when auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_username TEXT;
  base_username TEXT;
  final_username TEXT;
BEGIN
  requested_username := lower(trim(NEW.raw_user_meta_data->>'username'));
  base_username := lower(
    regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '', 'g')
  );

  IF requested_username IS NOT NULL AND length(requested_username) >= 3 THEN
    final_username := requested_username;
  ELSIF length(base_username) >= 3 THEN
    final_username := base_username;
  ELSE
    final_username := 'user';
  END IF;

  final_username := final_username || substr(replace(NEW.id::text, '-', ''), 1, 6);

  INSERT INTO public.profiles (id, username, display_name, referred_by_code)
  VALUES (
    NEW.id,
    final_username,
    coalesce(
      nullif(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    nullif(trim(NEW.raw_user_meta_data->>'referral_code'), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Creator wallet on creator_profiles insert (table must exist; trigger in migration 18)
CREATE OR REPLACE FUNCTION public.create_creator_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO wallets (owner_id, owner_type)
  VALUES (NEW.user_id, 'creator')
  ON CONFLICT (owner_id, owner_type) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Monthly partition maintenance (schedule via pg_cron / Edge Function)
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
