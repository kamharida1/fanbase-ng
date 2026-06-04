import { describe, expect, it } from "vitest";

import {
  canAccessPath,
  getRequiredRoleForPath,
  isPublicPath,
  sanitizeNextPath,
} from "@/lib/auth/paths";

describe("sanitizeNextPath", () => {
  it("allows safe relative paths", () => {
    expect(sanitizeNextPath("/feed")).toBe("/feed");
    expect(sanitizeNextPath("/creator/dashboard")).toBe("/creator/dashboard");
  });

  it("rejects external and auth loops", () => {
    expect(sanitizeNextPath("//evil.com")).toBeNull();
    expect(sanitizeNextPath("/login")).toBeNull();
    expect(sanitizeNextPath(null)).toBeNull();
  });
});

describe("isPublicPath", () => {
  it("includes health and webhooks", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/v1/webhooks/paystack")).toBe(true);
  });

  it("excludes feed", () => {
    expect(isPublicPath("/feed")).toBe(false);
  });
});

describe("getRequiredRoleForPath", () => {
  it("requires admin for finance", () => {
    expect(getRequiredRoleForPath("/admin/finance")).toBe("admin");
  });

  it("requires user for feed", () => {
    expect(getRequiredRoleForPath("/feed")).toBe("user");
  });
});

describe("canAccessPath", () => {
  it("allows creator on creator routes", () => {
    expect(canAccessPath("/creator/dashboard", "creator")).toBe(true);
  });

  it("denies user on admin", () => {
    expect(canAccessPath("/admin", "user")).toBe(false);
  });
});
