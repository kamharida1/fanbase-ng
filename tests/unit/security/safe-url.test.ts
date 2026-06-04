import { describe, expect, it } from "vitest";

import {
  buildAppActionUrl,
  sanitizeAppPath,
  toSafeNotificationHref,
} from "@/lib/security/safe-url";

describe("sanitizeAppPath", () => {
  it("allows relative paths", () => {
    expect(sanitizeAppPath("/feed")).toBe("/feed");
    expect(sanitizeAppPath("/messages?c=1")).toBe("/messages?c=1");
  });

  it("rejects protocol-relative and external", () => {
    expect(sanitizeAppPath("//evil.com")).toBeNull();
    expect(sanitizeAppPath("javascript:alert(1)")).toBeNull();
  });
});

describe("buildAppActionUrl", () => {
  it("builds absolute url for safe path", () => {
    expect(buildAppActionUrl("/creator/dashboard")).toBe(
      "http://localhost:3000/creator/dashboard",
    );
  });

  it("falls back to feed for unsafe path", () => {
    expect(buildAppActionUrl("//bad")).toBe("http://localhost:3000/feed");
  });
});

describe("toSafeNotificationHref", () => {
  it("accepts same-origin absolute urls", () => {
    expect(toSafeNotificationHref("http://localhost:3000/feed")).toBe("/feed");
  });

  it("rejects other origins", () => {
    expect(toSafeNotificationHref("https://evil.com/x")).toBeNull();
  });
});
