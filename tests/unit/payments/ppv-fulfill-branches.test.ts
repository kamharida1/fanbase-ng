import { describe, expect, it, vi } from "vitest";

import { fulfillPpvPurchase } from "@/lib/payments/ppv-processor";

vi.mock("@/lib/audit/log", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/wallets/ledger", () => ({ creditCreatorFromPayment: vi.fn() }));

describe("fulfillPpvPurchase failure branches", () => {
  it("rejects amount mismatch", async () => {
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "p1",
                    status: "pending",
                    amount_kobo: 5000,
                    payer_id: "11111111-1111-1111-1111-111111111111",
                    post_id: "22222222-2222-2222-2222-222222222222",
                    creator_id: "33333333-3333-3333-3333-333333333333",
                    type: "ppv",
                  },
                }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    const result = await fulfillPpvPurchase(admin as never, {
      chargeData: {
        reference: "fb_ppv_x",
        amount: 9999,
        metadata: {
          fan_id: "11111111-1111-1111-1111-111111111111",
          post_id: "22222222-2222-2222-2222-222222222222",
          creator_id: "33333333-3333-3333-3333-333333333333",
          purpose: "ppv_purchase",
        },
      },
    });
    expect(result).toBe(false);
  });
});
