import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/payments/processor", () => ({
  fulfillSubscriptionPayment: vi.fn().mockResolvedValue(null),
  fulfillTipPayment: vi.fn().mockResolvedValue(false),
  failSubscriptionPayment: vi.fn().mockResolvedValue(undefined),
  recordSubscriptionRenewal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/payments/ppv-processor", () => ({
  fulfillPpvPurchase: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/payments/refunds", () => ({
  processRefundWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/payments/disputes", () => ({
  processDisputeWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/audit/log", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/subscriptions/events", () => ({
  logSubscriptionEvent: vi.fn().mockResolvedValue(undefined),
}));

import { dispatchPaystackWebhook } from "@/lib/paystack/webhook-handler";
import { processRefundWebhook } from "@/lib/payments/refunds";
import { processDisputeWebhook } from "@/lib/payments/disputes";
import { failSubscriptionPayment, fulfillSubscriptionPayment } from "@/lib/payments/processor";

const makeAdmin = () => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }), order: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) }),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
  }),
  auth: { admin: { listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }) } },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
});

describe("dispatchPaystackWebhook", () => {
  it("handles unknown events without error", async () => {
    const admin = makeAdmin();
    await expect(
      dispatchPaystackWebhook(admin as never, {
        event: "custom.unknown_event" as never,
        data: {},
      }),
    ).resolves.toBeUndefined();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("routes refund events to processRefundWebhook", async () => {
    const admin = makeAdmin();
    const mockFn = vi.mocked(processRefundWebhook);
    mockFn.mockClear();

    await dispatchPaystackWebhook(admin as never, { event: "refund.pending", data: {} });

    expect(mockFn).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ event: "refund.pending", data: {} }),
    );
  });

  it("routes dispute events to processDisputeWebhook", async () => {
    const admin = makeAdmin();
    const mockFn = vi.mocked(processDisputeWebhook);
    mockFn.mockClear();

    await dispatchPaystackWebhook(admin as never, {
      event: "charge.dispute.create",
      data: {},
    });

    expect(mockFn).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ event: "charge.dispute.create" }),
    );
  });

  it("routes charge.failed with fb_sub_ reference to failSubscriptionPayment", async () => {
    const admin = makeAdmin();
    const mockFn = vi.mocked(failSubscriptionPayment);
    mockFn.mockClear();

    await dispatchPaystackWebhook(admin as never, {
      event: "charge.failed",
      data: {
        reference: "fb_sub_test001",
        gateway_response: "Insufficient funds",
      },
    });

    expect(mockFn).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ reference: "fb_sub_test001" }),
    );
  });

  it("routes charge.success with no metadata and no sub code to ppv/tip handlers", async () => {
    const admin = makeAdmin();
    const fulfillSub = vi.mocked(fulfillSubscriptionPayment);
    fulfillSub.mockClear();

    // Empty data → no metadata, no subscription_code → falls through to ppv/tip, not sub
    await dispatchPaystackWebhook(admin as never, {
      event: "charge.success",
      data: {},
    });

    // fulfillSubscriptionPayment is NOT called because checkoutMeta is null
    expect(fulfillSub).not.toHaveBeenCalled();
  });
});
