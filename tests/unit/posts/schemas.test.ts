import { describe, expect, it } from "vitest";

import {
  commentSchema,
  likePostSchema,
  upsertPostSchema,
} from "@/lib/posts/schemas";

describe("upsertPostSchema", () => {
  it("requires plan for tier visibility", () => {
    const result = upsertPostSchema.safeParse({
      type: "text",
      caption: "",
      visibility: "tier",
      publishNow: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires price for ppv", () => {
    const result = upsertPostSchema.safeParse({
      type: "text",
      visibility: "ppv",
      publishNow: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts public text post", () => {
    const result = upsertPostSchema.safeParse({
      type: "text",
      caption: "Hello",
      visibility: "public",
      publishNow: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("commentSchema", () => {
  it("requires body", () => {
    expect(
      commentSchema.safeParse({
        postId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        body: "",
      }).success,
    ).toBe(false);
  });
});

describe("likePostSchema", () => {
  it("requires uuid postId", () => {
    expect(likePostSchema.safeParse({ postId: "bad" }).success).toBe(false);
  });
});
