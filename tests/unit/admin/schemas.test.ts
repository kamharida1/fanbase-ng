import { describe, expect, it } from "vitest";

import {
  adminListQuerySchema,
  adminPayoutReviewSchema,
  adminUserStatusSchema,
} from "@/lib/admin/schemas";

describe("admin schemas", () => {
  it("parses user status update", () => {
    const r = adminUserStatusSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      status: "suspended",
    });
    expect(r.success).toBe(true);
  });

  it("parses payout review", () => {
    const r = adminPayoutReviewSchema.safeParse({
      requestId: "550e8400-e29b-41d4-a716-446655440001",
      action: "approve",
    });
    expect(r.success).toBe(true);
  });

  it("defaults list query page/limit", () => {
    const r = adminListQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(25);
    }
  });
});
