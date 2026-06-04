import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import { verifyPaystackSignature } from "@/lib/paystack/verify";

describe("verifyPaystackSignature", () => {
  it("verifies valid signature", () => {
    const body = '{"event":"charge.success"}';
    const secret = process.env.PAYSTACK_SECRET_KEY!;
    const hash = createHmac("sha512", secret).update(body).digest("hex");
    expect(verifyPaystackSignature(body, hash)).toBe(true);
  });

  it("rejects invalid signature", () => {
    expect(verifyPaystackSignature("{}", "bad")).toBe(false);
    expect(verifyPaystackSignature("{}", null)).toBe(false);
  });
});
