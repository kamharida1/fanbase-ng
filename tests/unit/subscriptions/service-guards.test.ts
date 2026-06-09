import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audit/log", () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/paystack/checkout", () => ({
  buildPaymentReference: vi.fn().mockReturnValue("ref_test"),
  createPaystackSubscription: vi.fn().mockResolvedValue(undefined),
  initializeSubscriptionCheckout: vi.fn().mockResolvedValue({ authorization_url: "https://example.com", reference: "ref_test" }),
}));
vi.mock("@/lib/paystack/plans", () => ({
  createPaystackPlan: vi.fn().mockResolvedValue("PLN_test"),
}));
vi.mock("@/lib/subscriptions/lifecycle", () => ({
  activateSubscription: vi.fn().mockResolvedValue({ subscriptionId: "sub-free-1" }),
  getBlockingSubscription: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/fans/queries", () => ({
  isFanBlocked: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));

import {
  ensurePaystackPlanCode,
  fetchPlanForSubscribe,
  startSubscription,
} from "@/lib/subscriptions/service";
import type { SubscriptionPlanRow } from "@/types/subscription";

const makePlan = (overrides: Partial<SubscriptionPlanRow> = {}): SubscriptionPlanRow =>
  ({
    id: "plan-1",
    creator_id: "creator-1",
    name: "Basic",
    description: null,
    price_kobo: 5000,
    currency: "NGN",
    billing_interval: "monthly",
    paystack_plan_code: null,
    benefits: [],
    sort_order: 0,
    is_active: true,
    trial_days: 0,
    ...overrides,
  }) as SubscriptionPlanRow;

describe("fetchPlanForSubscribe", () => {
  it("returns null when plan not found", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };

    const result = await fetchPlanForSubscribe(supabase as never, "plan-1");
    expect(result).toBeNull();
  });

  it("returns null on DB error", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "error" } }),
            }),
          }),
        }),
      }),
    };

    const result = await fetchPlanForSubscribe(supabase as never, "plan-1");
    expect(result).toBeNull();
  });

  it("returns the plan row when found", async () => {
    const plan = makePlan();
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: plan, error: null }),
            }),
          }),
        }),
      }),
    };

    const result = await fetchPlanForSubscribe(supabase as never, "plan-1");
    expect(result?.id).toBe("plan-1");
    expect(result?.name).toBe("Basic");
  });
});

describe("ensurePaystackPlanCode", () => {
  it("returns null for free billing interval without touching Paystack", async () => {
    const supabase = { from: vi.fn() };
    const plan = makePlan({ billing_interval: "free" });

    const result = await ensurePaystackPlanCode(supabase as never, plan);

    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns existing code when plan already has one", async () => {
    const supabase = { from: vi.fn() };
    const plan = makePlan({ paystack_plan_code: "PLN_existing" });

    const result = await ensurePaystackPlanCode(supabase as never, plan);

    expect(result).toBe("PLN_existing");
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("startSubscription – guard clauses", () => {
  const baseInput = {
    fanId: "fan-1",
    fanEmail: "fan@example.com",
    planId: "plan-1",
  };

  it("throws when plan is not found", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };

    await expect(startSubscription(supabase as never, baseInput)).rejects.toThrow(
      "Plan not found",
    );
  });

  it("throws when fan tries to subscribe to their own profile", async () => {
    const plan = makePlan({ creator_id: "fan-1" }); // same as fanId
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: plan, error: null }),
            }),
          }),
        }),
      }),
    };

    await expect(startSubscription(supabase as never, baseInput)).rejects.toThrow(
      "cannot subscribe to your own",
    );
  });

  it("throws when creator is not accepting subscribers", async () => {
    const plan = makePlan({ creator_id: "creator-1" });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "subscription_plans") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: plan, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "creator_profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { is_accepting_subscribers: false }, error: null }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    await expect(startSubscription(supabase as never, baseInput)).rejects.toThrow(
      "not accepting new subscribers",
    );
  });
});
