import { describe, expect, it } from "vitest";

import { mapAuthError } from "@/lib/auth/errors";

describe("mapAuthError", () => {
  it("maps known auth errors", () => {
    expect(mapAuthError("Invalid login credentials")).toBe(
      "Incorrect email or password.",
    );
    expect(mapAuthError("Email not confirmed")).toBe(
      "Please verify your email before signing in.",
    );
    expect(mapAuthError("Rate limit exceeded")).toBe(
      "Too many attempts. Please wait a few minutes and try again.",
    );
  });

  it("returns original for unknown", () => {
    expect(mapAuthError("Custom error")).toBe("Custom error");
  });
});
