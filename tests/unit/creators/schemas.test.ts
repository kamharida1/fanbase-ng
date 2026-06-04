import { describe, expect, it } from "vitest";

import {
  subscriptionPlanSchema,
  updateProfileBasicsSchema,
} from "@/lib/creators/schemas";

describe("updateProfileBasicsSchema", () => {
  it("validates username pattern", () => {
    expect(
      updateProfileBasicsSchema.safeParse({
        display_name: "Jane",
        username: "valid_user",
      }).success,
    ).toBe(true);
    expect(
      updateProfileBasicsSchema.safeParse({
        display_name: "Jane",
        username: "x",
      }).success,
    ).toBe(false);
  });
});

describe("subscriptionPlanSchema", () => {
  it("requires price for paid plans", () => {
    expect(
      subscriptionPlanSchema.safeParse({
        name: "Gold",
        billing_interval: "monthly",
        price_ngn: 0,
      }).success,
    ).toBe(false);
  });

  it("allows free plan with zero price", () => {
    expect(
      subscriptionPlanSchema.safeParse({
        name: "Free tier",
        billing_interval: "free",
        price_ngn: 0,
      }).success,
    ).toBe(true);
  });
});
