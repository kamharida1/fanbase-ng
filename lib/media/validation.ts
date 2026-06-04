import {
  ALL_ALLOWED_MIMES,
  ALLOWED_MIMES,
  CONTEXT_LIMITS,
  type AllowedMime,
} from "@/lib/media/constants";
import type { MediaUploadContext } from "@/types/media";

export type ValidatedUploadInput = {
  mime: AllowedMime;
  mediaKind: "image" | "video" | "audio" | "document";
  byteSize: number;
  filename: string;
  useStream: boolean;
};

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  pdf: "application/pdf",
};

/** Magic-byte signatures for server-side confirmation (first bytes). */
const MAGIC: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "video/mp4", bytes: [0x00, 0x00, 0x00], offset: 0 },
  { mime: "video/webm", bytes: [0x1a, 0x45, 0xdf, 0xa3] },
];

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export function inferMimeFromFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_MIME[ext] ?? null;
}

export function validateUploadRequest(input: {
  context: MediaUploadContext;
  mime: string;
  byteSize: number;
  filename: string;
}): { ok: true; data: ValidatedUploadInput } | { ok: false; error: string } {
  const limits = CONTEXT_LIMITS[input.context];
  const inferred = inferMimeFromFilename(input.filename);
  const mime = input.mime || inferred;

  if (!mime || !(ALL_ALLOWED_MIMES as readonly string[]).includes(mime)) {
    return { ok: false, error: "File type is not allowed." };
  }

  if (inferred && inferred !== mime) {
    return { ok: false, error: "Filename extension does not match MIME type." };
  }

  let mediaKind: ValidatedUploadInput["mediaKind"];
  if ((ALLOWED_MIMES.image as readonly string[]).includes(mime)) {
    mediaKind = "image";
    if (input.byteSize > limits.maxImageBytes) {
      return { ok: false, error: "Image exceeds size limit." };
    }
  } else if ((ALLOWED_MIMES.video as readonly string[]).includes(mime)) {
    mediaKind = "video";
    if (limits.maxVideoBytes === 0) {
      return { ok: false, error: "Video uploads are not allowed here." };
    }
    if (input.byteSize > limits.maxVideoBytes) {
      return { ok: false, error: "Video exceeds size limit." };
    }
  } else if ((ALLOWED_MIMES.audio as readonly string[]).includes(mime)) {
    mediaKind = "audio";
    if (input.byteSize > limits.maxFileBytes) {
      return { ok: false, error: "Audio file exceeds size limit." };
    }
  } else {
    mediaKind = "document";
    if (input.byteSize > limits.maxFileBytes) {
      return { ok: false, error: "File exceeds size limit." };
    }
  }

  const useStream =
    mediaKind === "video" &&
    input.context !== "profile" &&
    input.byteSize > 0;

  return {
    ok: true,
    data: {
      mime: mime as AllowedMime,
      mediaKind,
      byteSize: input.byteSize,
      filename: sanitizeFilename(input.filename),
      useStream,
    },
  };
}

export function validateMagicBytes(
  buffer: Uint8Array,
  expectedMime: string,
): boolean {
  if (expectedMime === "video/mp4") {
    if (buffer.length < 12) return false;
    const box = String.fromCharCode(
      buffer[4],
      buffer[5],
      buffer[6],
      buffer[7],
    );
    return box === "ftyp" || box === "moov" || box === "mdat";
  }

  if (expectedMime === "image/webp") {
    if (buffer.length < 12) return false;
    const riff = String.fromCharCode(...buffer.slice(0, 4));
    const webp = String.fromCharCode(...buffer.slice(8, 12));
    return riff === "RIFF" && webp === "WEBP";
  }

  for (const sig of MAGIC) {
    if (sig.mime !== expectedMime) continue;
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    const match = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (match) return true;
  }

  return false;
}
