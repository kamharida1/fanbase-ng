import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ALLOWED_ATTACHMENT_MIMES,
  MAX_ATTACHMENT_BYTES,
  MESSAGE_MEDIA_BUCKET,
} from "@/lib/messaging/constants";

function mimeToAttachmentType(
  mime: string,
): "image" | "video" | "audio" | "file" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export async function uploadMessageAttachment(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    userId: string;
    file: File;
  },
): Promise<
  | {
      storagePath: string;
      attachmentType: "image" | "video" | "audio" | "file";
      mime: string;
      filename: string;
      sizeBytes: number;
    }
  | { error: string }
> {
  if (input.file.size > MAX_ATTACHMENT_BYTES) {
    return { error: "Attachment must be under 50MB." };
  }

  if (
    !ALLOWED_ATTACHMENT_MIMES.includes(
      input.file.type as (typeof ALLOWED_ATTACHMENT_MIMES)[number],
    )
  ) {
    return { error: "File type is not allowed." };
  }

  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${input.conversationId}/${input.userId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from(MESSAGE_MEDIA_BUCKET)
    .upload(path, input.file, {
      upsert: false,
      contentType: input.file.type,
    });

  if (error) {
    return {
      error: error.message.includes("Bucket not found")
        ? "Message storage is not configured. Create the message-media bucket in Supabase."
        : error.message,
    };
  }

  return {
    storagePath: path,
    attachmentType: mimeToAttachmentType(input.file.type),
    mime: input.file.type,
    filename: input.file.name,
    sizeBytes: input.file.size,
  };
}

export async function getSignedAttachmentUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(MESSAGE_MEDIA_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
