-- Allow auth user deletion from Supabase Dashboard (cascade / set null on profile FKs)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    ALTER TABLE public.payments
      DROP CONSTRAINT IF EXISTS payments_payer_id_fkey;
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_payer_id_fkey
      FOREIGN KEY (payer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_users'
  ) THEN
    ALTER TABLE public.admin_users
      DROP CONSTRAINT IF EXISTS admin_users_profile_id_fkey;
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'disputes'
  ) THEN
    ALTER TABLE public.disputes
      DROP CONSTRAINT IF EXISTS disputes_payment_id_fkey;
    ALTER TABLE public.disputes
      ADD CONSTRAINT disputes_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations'
      AND column_name = 'initiated_by'
  ) THEN
    ALTER TABLE public.conversations
      DROP CONSTRAINT IF EXISTS conversations_initiated_by_fkey;
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_initiated_by_fkey
      FOREIGN KEY (initiated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

    ALTER TABLE public.conversations
      DROP CONSTRAINT IF EXISTS conversations_last_message_sender_id_fkey;
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_last_message_sender_id_fkey
      FOREIGN KEY (last_message_sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
