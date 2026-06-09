import { describe, expect, it } from "vitest";

import { calculateEarningsBreakdown } from "@/lib/wallets/fees";
import { PLATFORM_FEE_BPS, PAYMENT_FEE_BPS } from "@/lib/wallets/constants";

describe("calculateEarningsBreakdown – extended", () => {
  it("net equals gross minus both fees", () => {
    for (const gross of [100, 1000, 50_000, 500_000]) {
      const b = calculateEarningsBreakdown(gross);
      expect(b.netKobo).toBe(gross - b.platformFeeKobo - b.paymentFeeKobo);
    }
  });

  it("platform fee is floor(gross * PLATFORM_FEE_BPS / 10000)", () => {
    const gross = 9_999;
    const b = calculateEarningsBreakdown(gross);
    expect(b.platformFeeKobo).toBe(Math.floor((gross * PLATFORM_FEE_BPS) / 10_000));
  });

  it("payment fee is floor(gross * PAYMENT_FEE_BPS / 10000)", () => {
    const gross = 9_999;
    const b = calculateEarningsBreakdown(gross);
    expect(b.paymentFeeKobo).toBe(Math.floor((gross * PAYMENT_FEE_BPS) / 10_000));
  });

  it("net is never negative for reasonable amounts", () => {
    const b = calculateEarningsBreakdown(1);
    expect(b.netKobo).toBeGreaterThanOrEqual(0);
  });

  it("clearanceDays is a positive integer", () => {
    const b = calculateEarningsBreakdown(10_000);
    expect(Number.isInteger(b.clearanceDays)).toBe(true);
    expect(b.clearanceDays).toBeGreaterThan(0);
  });
});
