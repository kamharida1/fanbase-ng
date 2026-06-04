import { describe, expect, it } from "vitest";

import { parsePpvPurchaseMetadata } from "@/lib/payments/ppv-processor";

describe("parsePpvPurchaseMetadata", () => {
  it("parses valid ppv metadata", () => {
    const meta = parsePpvPurchaseMetadata({
      metadata: {
        fan_id: "fan-1",
        post_id: "post-1",
        creator_id: "creator-1",
        purpose: "ppv_purchase",
      },
    });
    expect(meta).toEqual({
      fan_id: "fan-1",
      post_id: "post-1",
      creator_id: "creator-1",
      purpose: "ppv_purchase",
    });
  });

  it("rejects invalid purpose", () => {
    expect(
      parsePpvPurchaseMetadata({
        metadata: { purpose: "subscription_checkout" },
      }),
    ).toBeNull();
  });
});
