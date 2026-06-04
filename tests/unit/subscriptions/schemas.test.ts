import { describe, expect, it } from "vitest";

import {
  cancelSubscriptionSchema,
  planBillingIntervalSchema,
  subscribeSchema,
} from "@/lib/subscriptions/schemas";

describe("subscription schemas", () => {
  it("parses billing interval", () => {
    expect(planBillingIntervalSchema.safeParse("monthly").success).toBe(true);
  });

  it("parses subscribe", () => {
    expect(
      subscribeSchema.safeParse({
        planId: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(true);
  });

  it("parses cancel", () => {
    expect(
      cancelSubscriptionSchema.safeParse({
        subscriptionId: "550e8400-e29b-41d4-a716-446655440001",
      }).success,
    ).toBe(true);
  });
});
