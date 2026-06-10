-- Fix: handle_new_user could generate a username longer than the
-- profiles_username_format constraint allows (^[a-z0-9_]{3,30}$),
-- causing signup to fail outright for emails/usernames whose
-- sanitized local-part is 25+ characters (24 chars + 6-char id suffix > 30).
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

  -- Cap to 24 chars so the 6-char id suffix below never exceeds the
  -- 30-char limit in profiles_username_format.
  final_username := left(final_username, 24)
    || substr(replace(NEW.id::text, '-', ''), 1, 6);

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
