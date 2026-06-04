import { describe, expect, it } from "vitest";

import {
  isAuthPath,
  isProtectedFanPath,
  isResetPasswordPath,
} from "@/lib/auth/paths";

describe("auth path helpers", () => {
  it("detects auth paths", () => {
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/login/forgot")).toBe(true);
    expect(isAuthPath("/feed")).toBe(false);
  });

  it("detects reset password", () => {
    expect(isResetPasswordPath("/reset-password")).toBe(true);
  });

  it("detects protected fan paths", () => {
    expect(isProtectedFanPath("/feed")).toBe(true);
    expect(isProtectedFanPath("/admin")).toBe(false);
  });
});
