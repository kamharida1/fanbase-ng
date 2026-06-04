import { describe, expect, it } from "vitest";

import {
  isPeriodValid,
  isSubscriptionAccessActive,
} from "@/lib/subscriptions/access";

describe("subscription access helpers", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  it("isPeriodValid treats null end as valid", () => {
    expect(isPeriodValid(null, now)).toBe(true);
  });

  it("isPeriodValid rejects expired period", () => {
    expect(isPeriodValid("2026-05-01T00:00:00Z", now)).toBe(false);
  });

  it("isSubscriptionAccessActive requires active status and valid period", () => {
    expect(
      isSubscriptionAccessActive({
        status: "active",
        current_period_end: "2026-12-01T12:00:00Z",
      }),
    ).toBe(true);
    expect(
      isSubscriptionAccessActive({
        status: "cancelled",
        current_period_end: "2026-12-01T12:00:00Z",
      }),
    ).toBe(false);
  });
});
