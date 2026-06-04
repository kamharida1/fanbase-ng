import { describe, expect, it } from "vitest";

import { sanitizeAppPath, toSafeNotificationHref } from "@/lib/security/safe-url";

describe("sanitizeAppPath extended", () => {
  it("rejects null bytes and backslashes", () => {
    expect(sanitizeAppPath("/feed\0")).toBeNull();
    expect(sanitizeAppPath("/path\\evil")).toBeNull();
  });

  it("rejects protocol injection in path", () => {
    expect(sanitizeAppPath("/javascript:alert(1)")).toBeNull();
  });
});

describe("toSafeNotificationHref extended", () => {
  it("returns null for empty", () => {
    expect(toSafeNotificationHref("")).toBeNull();
    expect(toSafeNotificationHref("   ")).toBeNull();
  });
});
