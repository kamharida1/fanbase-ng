-- Allow authenticated users to read their own admin_users row so
-- fetchAuthContext can resolve the admin role during session init.
-- Without this, RLS blocks the query and the role falls back to
-- profiles.role, sending admins to the creator/fan dashboard.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_users' AND policyname = 'admin_users_self_read'
  ) THEN
    EXECUTE 'CREATE POLICY admin_users_self_read ON admin_users
      FOR SELECT TO authenticated
      USING (profile_id = auth.uid())';
  END IF;
END $$;

-- Allow all authenticated users to read admin_roles (public role definitions).
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'admin_roles' AND policyname = 'admin_roles_authenticated_read'
  ) THEN
    EXECUTE 'CREATE POLICY admin_roles_authenticated_read ON admin_roles
      FOR SELECT TO authenticated, anon
      USING (true)';
  END IF;
END $$;
