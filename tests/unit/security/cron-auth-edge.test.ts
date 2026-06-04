import { describe, expect, it } from "vitest";

import { verifyCronBearerEdge } from "@/lib/security/cron-auth-edge";

describe("verifyCronBearerEdge", () => {
  it("accepts valid bearer", () => {
    process.env.CRON_SECRET = "test-cron-secret-32chars-min";
    expect(
      verifyCronBearerEdge("Bearer test-cron-secret-32chars-min"),
    ).toBe(true);
  });

  it("rejects invalid bearer", () => {
    process.env.CRON_SECRET = "test-cron-secret-32chars-min";
    expect(verifyCronBearerEdge("Bearer wrong")).toBe(false);
  });
});
