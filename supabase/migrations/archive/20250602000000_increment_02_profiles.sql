-- Increment 2 ONLY — run this first for incremental development.
-- Adds profiles + auto-create on signup + RLS. Skip 20250602000001 until later increments.

CREATE TYPE user_role AS ENUM ('fan', 'creator', 'admin', 'moderator');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned', 'pending_verification');
CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'fan',
  status user_status NOT NULL DEFAULT 'active',
  phone TEXT,
  country_code TEXT NOT NULL DEFAULT 'NG',
  locale TEXT NOT NULL DEFAULT 'en-NG',
  kyc_status kyc_status NOT NULL DEFAULT 'none',
  metadata JSONB NOT NULL DEFAULT '{}',
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_username ON profiles(username);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  base_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '', 'g'));

  IF requested_username IS NOT NULL AND length(requested_username) >= 3 THEN
    final_username := requested_username;
  ELSIF length(base_username) >= 3 THEN
    final_username := base_username;
  ELSE
    final_username := 'user';
  END IF;

  final_username := final_username || substr(replace(NEW.id::text, '-', ''), 1, 6);

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    final_username,
    coalesce(
      nullif(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      split_part(NEW.email, '@', 1)
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
