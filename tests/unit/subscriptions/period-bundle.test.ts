import { describe, expect, it } from "vitest";

import { addBundlePeriod } from "@/lib/subscriptions/period";

describe("addBundlePeriod", () => {
  it("adds 3 months", () => {
    const start = new Date("2026-01-15T00:00:00.000Z");
    const { start: s, end } = addBundlePeriod(start, 3);
    expect(s.getTime()).toBe(start.getTime());
    expect(end.getUTCMonth()).toBe(3); // April (0-indexed)
    expect(end.getUTCFullYear()).toBe(2026);
  });

  it("adds 6 months, crossing year boundary", () => {
    const start = new Date("2026-09-01T00:00:00.000Z");
    const { end } = addBundlePeriod(start, 6);
    expect(end.getUTCMonth()).toBe(2); // March
    expect(end.getUTCFullYear()).toBe(2027);
  });

  it("adds 12 months", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const { end } = addBundlePeriod(start, 12);
    expect(end.getUTCFullYear()).toBe(2027);
    expect(end.getUTCMonth()).toBe(2);
  });

  it("does not mutate the from date", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const originalTime = start.getTime();
    addBundlePeriod(start, 3);
    expect(start.getTime()).toBe(originalTime);
  });

  it("end is after start", () => {
    const start = new Date("2026-06-01T00:00:00.000Z");
    const { end } = addBundlePeriod(start, 1);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
