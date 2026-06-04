import type { SupabaseClient } from "@supabase/supabase-js";

import type { MediaUploadRow } from "@/types/media";

function mediaTypeFromMime(mime: string): "image" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

export async function bindUploadToContext(
  admin: SupabaseClient,
  upload: MediaUploadRow,
): Promise<MediaUploadRow | null> {
  if (upload.status === "ready" && upload.bound_entity_id) {
    return upload;
  }

  const now = new Date().toISOString();
  let boundEntityType: string | null = null;
  let boundEntityId: string | null = null;

  if (upload.context === "post") {
    const processingStatus =
      upload.provider === "stream" ? "processing" : "ready";

    const { data: media, error } = await admin
      .from("post_media")
      .insert({
        post_id: upload.context_ref_id,
        media_type: mediaTypeFromMime(upload.mime_type),
        r2_key: upload.object_key,
        stream_uid: upload.stream_uid,
        byte_size: upload.byte_size,
        processing_status: processingStatus,
        media_upload_id: upload.id,
        thumbnail_url:
          upload.provider === "stream" && upload.stream_uid
            ? `https://videodelivery.net/${upload.stream_uid}/thumbnails/thumbnail.jpg`
            : null,
      })
      .select("id")
      .single();

    if (error) return null;
    boundEntityType = "post_media";
    boundEntityId = media.id;

    const postType = mediaTypeFromMime(upload.mime_type);
    await admin
      .from("posts")
      .update({ type: postType })
      .eq("id", upload.context_ref_id)
      .eq("type", "text");
  } else if (upload.context === "message") {
    boundEntityType = "message_pending";
    boundEntityId = upload.id;
  } else if (upload.context === "profile") {
    boundEntityType = "profile";
    boundEntityId = upload.owner_id;
  }

  const { data: updated, error: upErr } = await admin
    .from("media_uploads")
    .update({
      status: "ready",
      ready_at: now,
      bound_entity_type: boundEntityType,
      bound_entity_id: boundEntityId,
    })
    .eq("id", upload.id)
    .select("*")
    .single();

  if (upErr || !updated) return null;
  return updated as MediaUploadRow;
}

export async function bindUploadToMessage(
  admin: SupabaseClient,
  input: {
    uploadId: string;
    messageId: string;
  },
): Promise<boolean> {
  const { data: upload } = await admin
    .from("media_uploads")
    .select("*")
    .eq("id", input.uploadId)
    .eq("status", "ready")
    .maybeSingle();

  if (!upload) return false;
  const row = upload as MediaUploadRow;

  const { error } = await admin
    .from("messages")
    .update({
      media_r2_key: row.object_key,
      media_upload_id: row.id,
      attachment_type: mediaTypeFromMime(row.mime_type),
      attachment_mime: row.mime_type,
      attachment_filename: row.original_filename,
      attachment_size_bytes: row.byte_size,
    })
    .eq("id", input.messageId);

  if (error) return false;

  await admin
    .from("media_uploads")
    .update({
      bound_entity_type: "message",
      bound_entity_id: input.messageId,
    })
    .eq("id", input.uploadId);

  return true;
}
