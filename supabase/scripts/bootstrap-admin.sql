-- Grant staff admin access to an existing platform user.
-- Run in Supabase SQL Editor after the user has signed up (auth.users + profiles row exist).
--
-- Replace email and role slug as needed:
--   super_admin | admin | moderator

INSERT INTO admin_users (email, display_name, role_id, profile_id, is_active)
SELECT
  u.email,
  coalesce(p.display_name, split_part(u.email, '@', 1)),
  r.id,
  p.id,
  true
FROM auth.users u
JOIN profiles p ON p.id = u.id
JOIN admin_roles r ON r.slug = 'super_admin'  -- change to admin or moderator if needed
WHERE lower(u.email) = lower('kamharida007@gmail.com')
ON CONFLICT (email) DO UPDATE SET
  profile_id = EXCLUDED.profile_id,
  role_id = EXCLUDED.role_id,
  is_active = true,
  updated_at = now();

-- Verify
SELECT au.email, au.is_active, au.profile_id, ar.slug AS role
FROM admin_users au
JOIN admin_roles ar ON ar.id = au.role_id
WHERE lower(au.email) = lower('kamharida007@gmail.com');
