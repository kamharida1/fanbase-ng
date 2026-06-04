-- Run in Supabase SQL Editor AFTER migration 20250603000004 (profiles TABLE) is applied.
-- Creates missing profile rows for auth users (e.g. signup before handle_new_user).

-- Step 1: PrivyChat left "profiles" as a VIEW — must be a TABLE for inserts
DO $$
DECLARE
  relkind "char";
  legacy_name text := 'profiles_privychat_legacy_view';
BEGIN
  SELECT c.relkind INTO relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'profiles';

  IF relkind = 'v' THEN
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = legacy_name
    ) THEN
      legacy_name := 'profiles_privychat_legacy_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
    END IF;
    EXECUTE format(
      'ALTER VIEW public.profiles RENAME TO %I',
      legacy_name
    );
    RAISE NOTICE 'Renamed profiles VIEW to %. Run: supabase db push', legacy_name;
  END IF;
END $$;

-- Step 2: Require the Fanbase profiles table (from migration 04)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND c.relkind = 'r'
  ) THEN
    RAISE EXCEPTION
      'public.profiles is not a table yet. From the project folder run: supabase migration repair --status reverted 20250603000004 && supabase db push';
  END IF;
END $$;

-- Step 3: Backfill rows
INSERT INTO public.profiles (id, username, display_name)
SELECT
  u.id,
  lower(
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'username'), ''),
      regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9]', '', 'g'),
      'user'
    )
  ) || substr(replace(u.id::text, '-', ''), 1, 6),
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
    split_part(u.email, '@', 1)
  )
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;
