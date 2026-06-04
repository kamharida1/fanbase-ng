import { describe, expect, it } from "vitest";

import { validateMagicBytes, validateUploadRequest } from "@/lib/media/validation";

describe("validateUploadRequest extended", () => {
  it("rejects oversized image", () => {
    const result = validateUploadRequest({
      context: "profile",
      mime: "image/png",
      byteSize: 50_000_000,
      filename: "big.png",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects video on profile context", () => {
    const result = validateUploadRequest({
      context: "profile",
      mime: "video/mp4",
      byteSize: 1024,
      filename: "v.mp4",
    });
    expect(result.ok).toBe(false);
  });
});

describe("validateMagicBytes extended", () => {
  it("validates webp", () => {
    const buf = new Uint8Array(12);
    buf.set([0x52, 0x49, 0x46, 0x46], 0);
    buf.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(validateMagicBytes(buf, "image/webp")).toBe(true);
  });

  it("validates mp4 ftyp", () => {
    const buf = new Uint8Array(12);
    buf.set([0x00, 0x00, 0x00, 0x18], 0);
    buf.set([0x66, 0x74, 0x79, 0x70], 4);
    expect(validateMagicBytes(buf, "video/mp4")).toBe(true);
  });
});
