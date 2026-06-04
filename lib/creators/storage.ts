import type { SupabaseClient } from "@supabase/supabase-js";

export const PROFILE_MEDIA_BUCKET = "profile-media";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_BANNER_BYTES = 10 * 1024 * 1024;

export async function uploadProfileImage(
  supabase: SupabaseClient,
  userId: string,
  type: "avatar" | "banner",
  file: File,
): Promise<{ url: string } | { error: string }> {
  const maxBytes = type === "avatar" ? MAX_AVATAR_BYTES : MAX_BANNER_BYTES;
  if (file.size > maxBytes) {
    return {
      error: `File must be under ${type === "avatar" ? "5MB" : "10MB"}.`,
    };
  }

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { error: "Use JPEG, PNG, or WebP." };
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${userId}/${type}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return {
      error:
        uploadError.message.includes("Bucket not found")
          ? "Storage not configured. Use image URL fields or create the profile-media bucket in Supabase."
          : uploadError.message,
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(path);

  return { url: publicUrl };
}
