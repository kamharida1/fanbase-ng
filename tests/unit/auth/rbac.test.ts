import { describe, expect, it } from "vitest";

import {
  getDefaultPathForRole,
  hasMinimumRole,
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
    expect(getDefaultPathForRole("creator")).toBe("/creator/dashboard");
    expect(getDefaultPathForRole("admin")).toBe("/admin");
  });
});
