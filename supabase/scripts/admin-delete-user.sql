-- Delete a user from Supabase when Dashboard → Authentication → Delete fails.
-- Replace USER_ID below, then run in SQL Editor (uses postgres / service role).

BEGIN;

-- ▼▼▼ SET THIS ▼▼▼
-- USER_ID: '550e8400-e29b-41d4-a716-446655440000'

DO $$
DECLARE
  uid uuid := 'PASTE_USER_UUID_HERE';
BEGIN
  IF uid IS NULL OR uid::text = 'PASTE_USER_UUID_HERE' THEN
    RAISE EXCEPTION 'Set uid in admin-delete-user.sql first';
  END IF;

  -- FKs without ON DELETE CASCADE block profile / auth deletion
  UPDATE public.admin_users SET profile_id = NULL WHERE profile_id = uid;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations'
      AND column_name = 'initiated_by'
  ) THEN
    EXECUTE 'UPDATE public.conversations SET initiated_by = NULL WHERE initiated_by = $1'
      USING uid;
    EXECUTE 'UPDATE public.conversations SET last_message_sender_id = NULL WHERE last_message_sender_id = $1'
      USING uid;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'disputes')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments')
  THEN
    DELETE FROM public.disputes
    WHERE payment_id IN (SELECT id FROM public.payments WHERE payer_id = uid);

    DELETE FROM public.payments WHERE payer_id = uid;
    DELETE FROM public.payments WHERE creator_id = uid;
  END IF;

  -- Removes auth user; profiles should CASCADE if FK exists
  DELETE FROM auth.users WHERE id = uid;

  IF NOT FOUND THEN
    RAISE NOTICE 'No auth.users row for %', uid;
  ELSE
    RAISE NOTICE 'Deleted auth user %', uid;
  END IF;
END $$;

COMMIT;
