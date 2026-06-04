import { describe, expect, it } from "vitest";

import { verifyCronBearer } from "@/lib/security/cron-auth";

describe("verifyCronBearer edge cases", () => {
  it("rejects missing bearer prefix", () => {
    process.env.CRON_SECRET = "test-cron-secret-32chars-min";
    expect(verifyCronBearer("test-cron-secret-32chars-min")).toBe(false);
  });

  it("rejects null header", () => {
    expect(verifyCronBearer(null)).toBe(false);
  });
});
