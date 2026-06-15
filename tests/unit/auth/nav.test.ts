import { describe, expect, it } from "vitest";

import { getNavForAuth } from "@/lib/auth/nav";
import type { AuthContext } from "@/types/auth";

function auth(partial: Partial<AuthContext> & Pick<AuthContext, "appRole">): AuthContext {
  return {
    userId: "user-1",
    email: "admin@example.com",
    profile: {
      id: "user-1",
      role: partial.profile?.role ?? "fan",
      status: "active",
      username: "adminuser",
      display_name: "Admin User",
      ...partial.profile,
    },
    adminRoleSlug: partial.adminRoleSlug ?? null,
    appRole: partial.appRole,
  };
}

describe("getNavForAuth", () => {
  it("returns fan nav for regular users", () => {
    const nav = getNavForAuth(auth({ appRole: "user" }));
    expect(nav.some((item) => item.href === "/messages")).toBe(true);
    expect(nav.some((item) => item.href === "/admin")).toBe(false);
  });

  it("merges member and admin nav for staff", () => {
    const nav = getNavForAuth(
      auth({ appRole: "super_admin", adminRoleSlug: "super_admin" }),
    );
    expect(nav.some((item) => item.href === "/feed")).toBe(true);
    expect(nav.some((item) => item.href === "/messages")).toBe(true);
    expect(nav.some((item) => item.href === "/admin")).toBe(true);
    expect(nav.some((item) => item.href === "/admin/audit")).toBe(true);
  });

  it("includes creator studio links for staff creators", () => {
    const nav = getNavForAuth(
      auth({
        appRole: "super_admin",
        adminRoleSlug: "super_admin",
        profile: {
          id: "user-1",
          role: "creator",
          status: "active",
          username: "adminuser",
          display_name: "Admin User",
        },
      }),
    );
    expect(nav.some((item) => item.href === "/creator/content")).toBe(true);
    expect(nav.some((item) => item.href === "/admin/users")).toBe(true);
  });
});
