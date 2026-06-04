-- Migration: Post media storage bucket
-- Fanbase NG

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  false,
  104857600,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY post_media_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'post-media'
    AND EXISTS (
      SELECT 1 FROM post_media pm
      JOIN posts p ON p.id = pm.post_id
      WHERE pm.r2_key = storage.objects.name
        AND public.can_view_post(auth.uid(), p.id)
    )
  );

CREATE POLICY post_media_storage_insert_creator ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.creator_id = auth.uid()
    )
  );

CREATE POLICY post_media_storage_delete_creator ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-media'
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.creator_id = auth.uid()
    )
  );
