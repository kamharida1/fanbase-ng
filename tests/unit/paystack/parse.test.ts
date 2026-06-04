import { describe, expect, it } from "vitest";

import {
  asNumber,
  asRecord,
  asString,
  parseNestedSubscriptionCode,
  parseSubscriptionCheckoutMetadata,
  parseSubscriptionCreatePayload,
} from "@/lib/paystack/parse";
import { PAYSTACK_SUBSCRIPTION_PURPOSE } from "@/lib/paystack/types";

describe("paystack parse helpers", () => {
  it("coerces primitives", () => {
    expect(asString("a")).toBe("a");
    expect(asString(1)).toBeUndefined();
    expect(asNumber(2)).toBe(2);
    expect(asRecord({ x: 1 })).toEqual({ x: 1 });
    expect(asRecord([])).toBeNull();
  });
});

describe("parseSubscriptionCheckoutMetadata", () => {
  it("parses valid checkout metadata", () => {
    const meta = parseSubscriptionCheckoutMetadata({
      metadata: {
        fan_id: "f1",
        plan_id: "p1",
        creator_id: "c1",
        billing_interval: "monthly",
        purpose: PAYSTACK_SUBSCRIPTION_PURPOSE,
      },
    });
    expect(meta?.fan_id).toBe("f1");
    expect(meta?.plan_id).toBe("p1");
  });

  it("returns null when incomplete", () => {
    expect(
      parseSubscriptionCheckoutMetadata({ metadata: { fan_id: "f1" } }),
    ).toBeNull();
  });
});

describe("parseNestedSubscriptionCode", () => {
  it("reads direct and nested codes", () => {
    expect(
      parseNestedSubscriptionCode({ subscription_code: "SUB_1" }),
    ).toBe("SUB_1");
    expect(
      parseNestedSubscriptionCode({
        subscription: { subscription_code: "SUB_2" },
      }),
    ).toBe("SUB_2");
  });
});

describe("parseSubscriptionCreatePayload", () => {
  it("extracts plan_code and customer email from a well-formed payload", () => {
    const result = parseSubscriptionCreatePayload({
      subscription_code: "SUB_abc",
      plan: { plan_code: "PLN_xyz", name: "Basic" },
      customer: { email: "fan@example.com", customer_code: "CUS_1" },
    });
    expect(result.planCode).toBe("PLN_xyz");
    expect(result.customerEmail).toBe("fan@example.com");
  });

  it("returns undefined fields when plan or customer is absent", () => {
    expect(parseSubscriptionCreatePayload({})).toEqual({
      planCode: undefined,
      customerEmail: undefined,
    });
    expect(
      parseSubscriptionCreatePayload({ plan: { plan_code: "PLN_x" } }),
    ).toEqual({ planCode: "PLN_x", customerEmail: undefined });
    expect(
      parseSubscriptionCreatePayload({
        customer: { email: "a@b.com" },
      }),
    ).toEqual({ planCode: undefined, customerEmail: "a@b.com" });
  });

  it("returns undefined when nested fields are the wrong type", () => {
    const result = parseSubscriptionCreatePayload({
      plan: { plan_code: 999 },
      customer: { email: null },
    });
    expect(result.planCode).toBeUndefined();
    expect(result.customerEmail).toBeUndefined();
  });
});
