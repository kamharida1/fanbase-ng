import { describe, expect, it } from "vitest";

import { buildPaystackEventId } from "@/lib/paystack/idempotency";

describe("buildPaystackEventId", () => {
  it("uses reference when present", () => {
    expect(
      buildPaystackEventId("charge.success", { reference: "fb_sub_abc" }),
    ).toBe("charge.success:fb_sub_abc");
  });

  it("falls back to subscription code", () => {
    expect(
      buildPaystackEventId("subscription.create", {
        subscription_code: "SUB_xyz",
      }),
    ).toBe("subscription.create:SUB_xyz");
  });

  it("hashes payload when no stable key", () => {
    const id = buildPaystackEventId("unknown.event", { foo: "bar" });
    expect(id.startsWith("unknown.event:")).toBe(true);
  });
});
