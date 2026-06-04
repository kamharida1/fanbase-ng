import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  POST_MEDIA_BUCKET,
} from "@/lib/posts/constants";

export async function uploadPostMediaFile(
  supabase: SupabaseClient,
  input: {
    postId: string;
    creatorId: string;
    file: File;
    sortOrder: number;
  },
): Promise<
  | {
      r2Key: string;
      mediaType: "image" | "video";
      mime: string;
      byteSize: number;
    }
  | { error: string }
> {
  const { file } = input;
  const isVideo = file.type.startsWith("video/");
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  if (file.size > maxBytes) {
    return {
      error: isVideo ? "Video must be under 100MB." : "Image must be under 15MB.",
    };
  }

  const allowedImages = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const allowedVideos = ["video/mp4", "video/webm"];
  const allowed = [...allowedImages, ...allowedVideos];

  if (!allowed.includes(file.type)) {
    return { error: "Unsupported file type." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${input.postId}/${input.sortOrder}_${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) {
    return {
      error: error.message.includes("Bucket not found")
        ? "Post media storage is not configured."
        : error.message,
    };
  }

  return {
    r2Key: path,
    mediaType: isVideo ? "video" : "image",
    mime: file.type,
    byteSize: file.size,
  };
}

export async function getPostMediaSignedUrl(
  supabase: SupabaseClient,
  r2Key: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUrl(r2Key, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
