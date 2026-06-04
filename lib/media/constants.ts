import type { MediaUploadContext } from "@/types/media";

export const PRESIGN_TTL_SECONDS = 15 * 60;
export const DELIVERY_TTL_SECONDS = 60 * 60;
export const MAX_SCAN_WAIT_MS = 5 * 60 * 1000;

export const CONTEXT_LIMITS: Record<
  MediaUploadContext,
  { maxImageBytes: number; maxVideoBytes: number; maxFileBytes: number }
> = {
  post: {
    maxImageBytes: 15 * 1024 * 1024,
    maxVideoBytes: 500 * 1024 * 1024,
    maxFileBytes: 15 * 1024 * 1024,
  },
  message: {
    maxImageBytes: 15 * 1024 * 1024,
    maxVideoBytes: 100 * 1024 * 1024,
    maxFileBytes: 50 * 1024 * 1024,
  },
  profile: {
    maxImageBytes: 5 * 1024 * 1024,
    maxVideoBytes: 0,
    maxFileBytes: 5 * 1024 * 1024,
  },
};

export const ALLOWED_MIMES = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/mp4", "audio/webm"],
  document: ["application/pdf"],
} as const;

export const ALL_ALLOWED_MIMES = [
  ...ALLOWED_MIMES.image,
  ...ALLOWED_MIMES.video,
  ...ALLOWED_MIMES.audio,
  ...ALLOWED_MIMES.document,
] as const;

export type AllowedMime = (typeof ALL_ALLOWED_MIMES)[number];
