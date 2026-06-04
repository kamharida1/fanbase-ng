import { describe, expect, it } from "vitest";

import { validateUploadRequest } from "@/lib/media/validation";

describe("validateUploadRequest audio and document", () => {
  it("accepts audio within limit", () => {
    const result = validateUploadRequest({
      context: "message",
      mime: "audio/mpeg",
      byteSize: 1024,
      filename: "a.mp3",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts pdf document", () => {
    const result = validateUploadRequest({
      context: "message",
      mime: "application/pdf",
      byteSize: 1024,
      filename: "doc.pdf",
    });
    expect(result.ok).toBe(true);
  });
});
