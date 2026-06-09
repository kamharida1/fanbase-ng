import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/subscriptions/events", () => ({ logSubscriptionEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/paystack/plans", () => ({ disablePaystackSubscription: vi.fn().mockResolvedValue(undefined) }));

import { cancelSubscriptionAtPeriodEnd } from "@/lib/subscriptions/lifecycle";

function makeSupabase(sub: unknown | null, updateError: unknown = null) {
  return {
    from: vi.fn((table: string) => {
      if (table === "subscriptions") {
        const updateChain = {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: updateError }),
          }),
        };
        return {
          ...updateChain,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: sub,
                  error: sub ? null : { message: "not found" },
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: updateError }),
          }),
        };
      }
      if (table === "subscription_events") {
        return { insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {}, error: null }) }) }) };
      }
      return {};
    }),
  };
}

describe("cancelSubscriptionAtPeriodEnd", () => {
  it("throws when subscription is not found", async () => {
    const supabase = makeSupabase(null);
    await expect(
      cancelSubscriptionAtPeriodEnd(supabase as never, "sub-1", "fan-1"),
    ).rejects.toThrow("Subscription not found.");
  });

  it("throws when subscription is not active", async () => {
    const sub = { id: "sub-1", fan_id: "fan-1", status: "expired", paystack_subscription_code: null, cancel_at_period_end: false };
    const supabase = makeSupabase(sub);
    await expect(
      cancelSubscriptionAtPeriodEnd(supabase as never, "sub-1", "fan-1"),
    ).rejects.toThrow("not active");
  });

  it("returns early when already scheduled for cancellation", async () => {
    const sub = { id: "sub-1", fan_id: "fan-1", status: "active", paystack_subscription_code: null, cancel_at_period_end: true };
    const supabase = makeSupabase(sub);
    // Should not throw and not call update
    await expect(
      cancelSubscriptionAtPeriodEnd(supabase as never, "sub-1", "fan-1"),
    ).resolves.toBeUndefined();
  });

  it("marks active subscription for cancellation at period end", async () => {
    const sub = { id: "sub-1", fan_id: "fan-1", status: "active", paystack_subscription_code: null, cancel_at_period_end: false };
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: sub, error: null }),
                }),
              }),
            }),
            update: updateMock,
          };
        }
        if (table === "subscription_events") {
          return { insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {}, error: null }) }) }) };
        }
        return {};
      }),
    };

    await cancelSubscriptionAtPeriodEnd(supabase as never, "sub-1", "fan-1");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ cancel_at_period_end: true }),
    );
  });
});
