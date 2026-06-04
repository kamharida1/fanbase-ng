import { describe, expect, it } from "vitest";

import { subscriptionPlanSchema } from "@/lib/creators/schemas";

describe("subscriptionPlanSchema paid plans", () => {
  it("accepts monthly plan with price", () => {
    const result = subscriptionPlanSchema.safeParse({
      name: "Pro",
      billing_interval: "monthly",
      price_ngn: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects annual plan without price", () => {
    const result = subscriptionPlanSchema.safeParse({
      name: "Pro",
      billing_interval: "annual",
      price_ngn: 0,
    });
    expect(result.success).toBe(false);
  });
});
