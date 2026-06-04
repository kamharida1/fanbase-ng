import { describe, expect, it } from "vitest";

import { presignMediaSchema, virusScanWebhookSchema } from "@/lib/media/schemas";

describe("media schemas", () => {
  it("parses presign payload", () => {
    const r = presignMediaSchema.safeParse({
      context: "post",
      contextRefId: "550e8400-e29b-41d4-a716-446655440000",
      mime: "image/jpeg",
      byteSize: 1024,
      filename: "photo.jpg",
    });
    expect(r.success).toBe(true);
  });

  it("parses virus scan webhook", () => {
    const r = virusScanWebhookSchema.safeParse({
      uploadId: "550e8400-e29b-41d4-a716-446655440001",
      status: "clean",
    });
    expect(r.success).toBe(true);
  });
});
