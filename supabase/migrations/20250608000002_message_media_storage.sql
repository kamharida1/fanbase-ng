-- Migration: Private message attachment storage
-- Fanbase NG

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-media',
  'message-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/mp4',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY message_media_select_participant ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-media'
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.fan_id = auth.uid() OR c.creator_id = auth.uid())
    )
  );

CREATE POLICY message_media_insert_participant ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message-media'
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.fan_id = auth.uid() OR c.creator_id = auth.uid())
    )
  );
