import { describe, expect, it, vi } from "vitest";

import { getPaymentByReference } from "@/lib/payments/processor";

describe("getPaymentByReference", () => {
  it("returns payment row", async () => {
    const payment = {
      id: "p1",
      payer_id: "fan",
      paystack_reference: "ref_1",
      amount_kobo: 1000,
      status: "pending",
      type: "subscription",
      subscription_id: null,
      post_id: null,
      creator_id: "c1",
      metadata: {},
    };

    const admin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: payment }),
          }),
        }),
      }),
    };

    const row = await getPaymentByReference(admin as never, "ref_1");
    expect(row?.id).toBe("p1");
  });
});
