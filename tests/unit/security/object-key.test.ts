import { describe, expect, it } from "vitest";

import { assertSafeObjectKey } from "@/lib/security/object-key";

describe("assertSafeObjectKey", () => {
  const ownerId = "11111111-1111-1111-1111-111111111111";
  const uploadId = "22222222-2222-2222-2222-222222222222";

  it("accepts valid post key", () => {
    expect(() =>
      assertSafeObjectKey(`posts/${ownerId}/${uploadId}/photo.jpg`, {
        ownerId,
        uploadId,
        context: "post",
      }),
    ).not.toThrow();
  });

  it("rejects path traversal", () => {
    expect(() =>
      assertSafeObjectKey(`posts/${ownerId}/../evil/file.jpg`, {
        ownerId,
        uploadId,
        context: "post",
      }),
    ).toThrow();
  });

  it("rejects owner mismatch", () => {
    expect(() =>
      assertSafeObjectKey(`posts/other/${uploadId}/file.jpg`, {
        ownerId,
        uploadId,
        context: "post",
      }),
    ).toThrow();
  });
});
