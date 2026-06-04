import { describe, expect, it, vi } from "vitest";

import { fulfillPpvPurchase } from "@/lib/payments/ppv-processor";

vi.mock("@/lib/audit/log", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/wallets/ledger", () => ({
  creditCreatorFromPayment: vi.fn(),
}));

describe("fulfillPpvPurchase", () => {
  const fanId = "11111111-1111-1111-1111-111111111111";
  const postId = "22222222-2222-2222-2222-222222222222";
  const creatorId = "33333333-3333-3333-3333-333333333333";
  const reference = "fb_ppv_testref123";

  function buildAdmin(overrides?: {
    paymentStatus?: string;
    existingPurchase?: boolean;
  }) {
    const payment = {
      id: "pay-1",
      status: overrides?.paymentStatus ?? "pending",
      amount_kobo: 5000,
      payer_id: fanId,
      post_id: postId,
      creator_id: creatorId,
      type: "ppv",
    };

    return {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: payment }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === "posts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    ppv_price_kobo: 5000,
                    visibility: "ppv",
                    moderation_status: "approved",
                    status: "published",
                  },
                }),
              }),
            }),
          };
        }
        if (table === "ppv_purchases") {
          const purchaseQuery = {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: overrides?.existingPurchase ? { id: "existing" } : null,
            }),
          };
          purchaseQuery.eq.mockReturnValue(purchaseQuery);
          return {
            select: vi.fn().mockReturnValue(purchaseQuery),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };
  }

  it("returns false for invalid metadata", async () => {
    const result = await fulfillPpvPurchase(buildAdmin() as never, {
      chargeData: { reference, amount: 5000 },
    });
    expect(result).toBe(false);
  });

  it("fulfills valid ppv payment", async () => {
    const result = await fulfillPpvPurchase(buildAdmin() as never, {
      chargeData: {
        reference,
        amount: 5000,
        id: "txn_1",
        metadata: {
          fan_id: fanId,
          post_id: postId,
          creator_id: creatorId,
          purpose: "ppv_purchase",
        },
      },
    });
    expect(result).toBe(true);
  });

  it("is idempotent when already successful", async () => {
    const result = await fulfillPpvPurchase(
      buildAdmin({ paymentStatus: "success" }) as never,
      {
        chargeData: {
          reference,
          amount: 5000,
          metadata: {
            fan_id: fanId,
            post_id: postId,
            creator_id: creatorId,
            purpose: "ppv_purchase",
          },
        },
      },
    );
    expect(result).toBe(true);
  });
});
