-- Increment 3 — Supabase Storage for profile photos & banners
-- Create bucket in Dashboard if this insert fails on your plan.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-media',
  'profile-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY profile_media_select ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-media');

-- Authenticated users upload to their own folder (userId/filename)
CREATE POLICY profile_media_insert_own ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY profile_media_update_own ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY profile_media_delete_own ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
