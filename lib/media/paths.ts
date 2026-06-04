import { sanitizeFilename } from "@/lib/media/validation";
import type { MediaUploadContext } from "@/types/media";

export function buildObjectKey(input: {
  context: MediaUploadContext;
  ownerId: string;
  uploadId: string;
  filename: string;
}): string {
  const prefix =
    input.context === "post"
      ? "posts"
      : input.context === "message"
        ? "messages"
        : "profiles";

  const safeName = sanitizeFilename(input.filename);

  return `${prefix}/${input.ownerId}/${input.uploadId}/${safeName}`;
}
