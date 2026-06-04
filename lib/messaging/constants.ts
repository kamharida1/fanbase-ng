export const MAX_MESSAGE_BODY_LENGTH = 4000;
export const MAX_REQUEST_INTRO_MESSAGES = 1;
export const MESSAGE_MEDIA_BUCKET = "message-media";
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "application/pdf",
] as const;
