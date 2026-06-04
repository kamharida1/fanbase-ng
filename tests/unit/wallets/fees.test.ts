import { describe, expect, it } from "vitest";

import { calculateEarningsBreakdown } from "@/lib/wallets/fees";

describe("calculateEarningsBreakdown", () => {
  it("deducts platform and payment fees", () => {
    const b = calculateEarningsBreakdown(10_000);
    expect(b.grossKobo).toBe(10_000);
    expect(b.platformFeeKobo).toBeGreaterThan(0);
    expect(b.paymentFeeKobo).toBeGreaterThan(0);
    expect(b.netKobo).toBe(
      b.grossKobo - b.platformFeeKobo - b.paymentFeeKobo,
    );
  });
});
