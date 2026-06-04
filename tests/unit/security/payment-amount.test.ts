import { describe, expect, it } from "vitest";

import { chargeAmountMatchesPayment } from "@/lib/security/payment-amount";

describe("chargeAmountMatchesPayment", () => {
  it("matches equal positive amounts", () => {
    expect(chargeAmountMatchesPayment(5000, 5000)).toBe(true);
  });

  it("rejects mismatch", () => {
    expect(chargeAmountMatchesPayment(5000, 5001)).toBe(false);
  });

  it("rejects non-positive", () => {
    expect(chargeAmountMatchesPayment(0, 0)).toBe(false);
  });
});
