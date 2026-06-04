-- Find rows blocking deletion of an auth user.
-- Replace the UUID in the DO block, run in Supabase SQL Editor.

DO $$
DECLARE
  uid uuid := 'PASTE_USER_UUID_HERE';
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.profiles WHERE id = uid;
  RAISE NOTICE 'profiles: %', n;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    SELECT count(*) INTO n FROM public.payments WHERE payer_id = uid;
    RAISE NOTICE 'payments (payer): %', n;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_users') THEN
    SELECT count(*) INTO n FROM public.admin_users WHERE profile_id = uid;
    RAISE NOTICE 'admin_users (profile_id): %', n;
  END IF;
END $$;

SELECT
  c.conrelid::regclass AS blocking_table,
  pg_get_constraintdef(c.oid) AS constraint_def
FROM pg_constraint c
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass;
