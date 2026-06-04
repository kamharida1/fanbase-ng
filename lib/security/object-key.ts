import type { MediaUploadContext } from "@/types/media";

const CONTEXT_PREFIX: Record<MediaUploadContext, string> = {
  post: "posts",
  message: "messages",
  profile: "profiles",
};

export function assertSafeObjectKey(
  objectKey: string,
  input: { ownerId: string; uploadId: string; context: MediaUploadContext },
): void {
  if (!objectKey || objectKey.includes("..") || objectKey.includes("\\")) {
    throw new Error("Invalid storage key.");
  }

  const parts = objectKey.split("/");
  const expectedPrefix = CONTEXT_PREFIX[input.context];

  if (
    parts.length !== 4 ||
    parts[0] !== expectedPrefix ||
    parts[1] !== input.ownerId ||
    parts[2] !== input.uploadId
  ) {
    throw new Error("Storage key does not match upload session.");
  }

  const filename = parts[3];
  if (!filename || filename.includes("/") || filename.includes("..")) {
    throw new Error("Invalid storage filename.");
  }
}
