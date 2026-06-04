import { afterEach, describe, expect, it } from "vitest";

import { verifyCronBearer } from "@/lib/security/cron-auth";

describe("verifyCronBearer", () => {
  const original = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = original;
  });

  it("accepts valid bearer", () => {
    process.env.CRON_SECRET = "test-cron-secret-32chars-min";
    expect(
      verifyCronBearer("Bearer test-cron-secret-32chars-min"),
    ).toBe(true);
  });

  it("rejects wrong secret", () => {
    process.env.CRON_SECRET = "test-cron-secret-32chars-min";
    expect(verifyCronBearer("Bearer wrong-secret-value-here")).toBe(false);
  });

  it("rejects short configured secret", () => {
    process.env.CRON_SECRET = "short";
    expect(verifyCronBearer("Bearer short")).toBe(false);
  });
});
