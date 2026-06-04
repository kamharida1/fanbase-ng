import { describe, expect, it } from "vitest";

import {
  inferMimeFromFilename,
  sanitizeFilename,
  validateMagicBytes,
  validateUploadRequest,
} from "@/lib/media/validation";

describe("sanitizeFilename", () => {
  it("strips path segments and unsafe chars", () => {
    expect(sanitizeFilename("../../evil/name$.png")).toBe("name_.png");
  });
});

describe("inferMimeFromFilename", () => {
  it("infers from extension", () => {
    expect(inferMimeFromFilename("photo.jpg")).toBe("image/jpeg");
    expect(inferMimeFromFilename("noext")).toBeNull();
  });
});

describe("validateUploadRequest", () => {
  it("accepts valid image for post context", () => {
    const result = validateUploadRequest({
      context: "post",
      mime: "image/png",
      byteSize: 1024,
      filename: "pic.png",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mediaKind).toBe("image");
    }
  });

  it("rejects mime mismatch", () => {
    const result = validateUploadRequest({
      context: "post",
      mime: "image/png",
      byteSize: 1024,
      filename: "pic.jpg",
    });
    expect(result.ok).toBe(false);
  });
});

describe("validateMagicBytes", () => {
  it("detects png signature", () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    expect(validateMagicBytes(buf, "image/png")).toBe(true);
  });

  it("detects pdf signature", () => {
    const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(validateMagicBytes(buf, "application/pdf")).toBe(true);
  });
});
