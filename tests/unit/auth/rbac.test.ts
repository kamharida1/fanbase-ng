import { describe, expect, it } from "vitest";

import {
  getDefaultPathForRole,
  hasMinimumRole,
  isStaffRole,
  mapProfileRoleToAppRole,
  resolveAppRole,
} from "@/lib/auth/rbac";

describe("hasMinimumRole", () => {
  it("ranks roles correctly", () => {
    expect(hasMinimumRole("admin", "moderator")).toBe(true);
    expect(hasMinimumRole("user", "creator")).toBe(false);
    expect(hasMinimumRole("super_admin", "admin")).toBe(true);
  });
});

describe("mapProfileRoleToAppRole", () => {
  it("maps fan to user", () => {
    expect(mapProfileRoleToAppRole("fan")).toBe("user");
  });
});

describe("resolveAppRole", () => {
  it("prefers admin slug", () => {
    expect(resolveAppRole("fan", "super_admin")).toBe("super_admin");
    expect(resolveAppRole("creator", "moderator")).toBe("moderator");
  });

  it("falls back to profile role", () => {
    expect(resolveAppRole("creator", null)).toBe("creator");
  });
});

describe("getDefaultPathForRole", () => {
  it("returns role home paths", () => {
    expect(getDefaultPathForRole("user")).toBe("/feed");
    expect(getDefaultPathForRole("creator")).toBe("/feed");
    expect(getDefaultPathForRole("admin")).toBe("/feed");
    expect(getDefaultPathForRole("super_admin")).toBe("/feed");
  });

  it("identifies staff roles", () => {
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("moderator")).toBe(true);
    expect(isStaffRole("creator")).toBe(false);
  });
});
