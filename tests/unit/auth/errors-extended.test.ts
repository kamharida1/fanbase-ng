import { describe, expect, it } from "vitest";

import { mapAuthError } from "@/lib/auth/errors";

describe("mapAuthError extended", () => {
  it("maps password and signup errors", () => {
    expect(mapAuthError("Password should be at least 6 characters")).toContain(
      "8 characters",
    );
    expect(mapAuthError("User already registered")).toContain("already exists");
    expect(mapAuthError("Signup is disabled")).toContain("unavailable");
  });
});
