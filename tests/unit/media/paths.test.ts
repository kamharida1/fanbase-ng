import { describe, expect, it } from "vitest";

import { buildObjectKey } from "@/lib/media/paths";

describe("buildObjectKey", () => {
  it("builds namespaced key", () => {
    const key = buildObjectKey({
      context: "message",
      ownerId: "user-1",
      uploadId: "up-1",
      filename: "clip.mp4",
    });
    expect(key).toBe("messages/user-1/up-1/clip.mp4");
  });

  it("sanitizes filename", () => {
    const key = buildObjectKey({
      context: "profile",
      ownerId: "u",
      uploadId: "id",
      filename: "../../bad name.png",
    });
    expect(key).not.toContain("..");
  });
});
