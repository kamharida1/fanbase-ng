import { describe, expect, it } from "vitest";

import { mapProfileRoleToAppRole, resolveAppRole } from "@/lib/auth/rbac";

describe("rbac extended", () => {
  it("maps all profile roles", () => {
    expect(mapProfileRoleToAppRole("moderator")).toBe("moderator");
    expect(mapProfileRoleToAppRole("admin")).toBe("admin");
    expect(mapProfileRoleToAppRole("unknown" as never)).toBe("user");
  });

  it("resolves admin slug over profile", () => {
    expect(resolveAppRole("fan", "admin")).toBe("admin");
  });
});
