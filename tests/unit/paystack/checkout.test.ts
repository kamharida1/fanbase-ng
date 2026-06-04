import { describe, expect, it } from "vitest";

import { buildPaymentReference } from "@/lib/paystack/checkout";

describe("buildPaymentReference", () => {
  it("generates fb_sub prefix references", () => {
    const ref = buildPaymentReference();
    expect(ref.startsWith("fb_sub_")).toBe(true);
    expect(ref.length).toBeGreaterThan(10);
  });

  it("generates unique references", () => {
    const a = buildPaymentReference();
    const b = buildPaymentReference();
    expect(a).not.toBe(b);
  });
});
