import { describe, expect, it } from "vitest";

import {
  billingIntervalLabel,
  formatPlanPrice,
} from "@/lib/subscriptions/format";

describe("subscriptions format", () => {
  it("labels billing intervals", () => {
    expect(billingIntervalLabel("monthly")).toBe("month");
    expect(billingIntervalLabel("free")).toBe("free");
  });

  it("formats plan prices", () => {
    expect(formatPlanPrice(0, "free")).toBe("Free");
    expect(formatPlanPrice(500_000, "monthly")).toContain("/month");
    expect(formatPlanPrice(5_000_000, "annual")).toContain("/year");
  });
});
