import { describe, expect, it } from "vitest";

import {
  addPeriod,
  extendPeriod,
  pastDueGraceEnds,
  PAST_DUE_GRACE_DAYS,
} from "@/lib/subscriptions/period";

describe("addPeriod", () => {
  it("adds monthly period", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const { end } = addPeriod(start, "monthly");
    expect(end.getUTCMonth()).toBe(1);
  });

  it("adds trial days", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const { end } = addPeriod(start, "monthly", 7);
    const diff = end.getTime() - start.getTime();
    expect(diff).toBe(7 * 86_400_000);
  });

  it("handles free tier long period", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const { end } = addPeriod(start, "free");
    expect(end.getUTCFullYear()).toBeGreaterThan(2100);
  });
});

describe("extendPeriod", () => {
  it("extends from future end", () => {
    const future = new Date(Date.now() + 86_400_000);
    const { end } = extendPeriod(future, "monthly");
    expect(end.getTime()).toBeGreaterThan(future.getTime());
  });
});

describe("pastDueGraceEnds", () => {
  it("adds grace days", () => {
    const end = new Date("2026-01-01T00:00:00.000Z");
    const grace = pastDueGraceEnds(end);
    expect(grace.getTime() - end.getTime()).toBe(
      PAST_DUE_GRACE_DAYS * 86_400_000,
    );
  });
});
