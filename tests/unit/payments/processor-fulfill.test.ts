import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audit/log", () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/wallets/ledger", () => ({ creditCreatorFromPayment: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/subscriptions/service", () => ({ completePaidSubscription: vi.fn().mockResolvedValue("new-sub-id") }));
vi.mock("@/lib/referrals/actions", () => ({ qualifyAndRewardReferral: vi.fn().mockResolvedValue(undefined) }));

import { fulfillSubscriptionPayment } from "@/lib/payments/processor";

const FAN_ID = "fan-uuid-001";
const PLAN_ID = "plan-uuid-001";
const CREATOR_ID = "creator-uuid-001";
const AMOUNT_KOBO = 10_000;

const validMeta = {
  fan_id: FAN_ID,
  plan_id: PLAN_ID,
  creator_id: CREATOR_ID,
  billing_interval: "monthly",
  purpose: "subscription_checkout",
};

const validPayment = {
  id: "pay-001",
  payer_id: FAN_ID,
  paystack_reference: "ref_001",
  amount_kobo: AMOUNT_KOBO,
  status: "pending",
  type: "subscription",
  subscription_id: null,
  post_id: null,
  creator_id: CREATOR_ID,
  metadata: {},
};

const activePlan = {
  id: PLAN_ID,
  price_kobo: AMOUNT_KOBO,
  is_active: true,
  creator_id: CREATOR_ID,
};

function makeAdmin({
  payment = validPayment as typeof validPayment | null,
  plan = activePlan as typeof activePlan | null,
} = {}) {
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
      if (table === "subscription_plans") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: plan }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "pay-001" }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "sub-event-1" }, error: null }),
          }),
        }),
      };
    }),
  };
}

describe("fulfillSubscriptionPayment – guard clauses", () => {
  it("returns null when charge data has no subscription metadata", async () => {
    const admin = makeAdmin();
    const result = await fulfillSubscriptionPayment(admin as never, {
      chargeData: { reference: "ref_001", amount: AMOUNT_KOBO },
      source: "webhook",
    });
    expect(result).toBeNull();
  });

  it("returns null when charge data has no reference", async () => {
    const admin = makeAdmin();
    const result = await fulfillSubscriptionPayment(admin as never, {
      chargeData: { amount: AMOUNT_KOBO, metadata: validMeta },
      source: "webhook",
    });
    expect(result).toBeNull();
  });

  it("returns null when payment is not found", async () => {
    const admin = makeAdmin({ payment: null });
    const result = await fulfillSubscriptionPayment(admin as never, {
      chargeData: { reference: "ref_001", amount: AMOUNT_KOBO, metadata: validMeta },
      source: "webhook",
    });
    expect(result).toBeNull();
  });

  it("returns null when fan_id in metadata does not match payment payer_id", async () => {
    const admin = makeAdmin({
      payment: { ...validPayment, payer_id: "different-fan-id" },
    });
    const result = await fulfillSubscriptionPayment(admin as never, {
      chargeData: { reference: "ref_001", amount: AMOUNT_KOBO, metadata: validMeta },
      source: "webhook",
    });
    expect(result).toBeNull();
  });

  it("returns null when charge amount does not match payment amount", async () => {
    const admin = makeAdmin();
    const result = await fulfillSubscriptionPayment(admin as never, {
      chargeData: {
        reference: "ref_001",
        amount: AMOUNT_KOBO + 500, // wrong amount
        metadata: validMeta,
      },
      source: "webhook",
    });
    expect(result).toBeNull();
  });

  it("returns null when plan is not found", async () => {
    const admin = makeAdmin({ plan: null });
    const result = await fulfillSubscriptionPayment(admin as never, {
      chargeData: { reference: "ref_001", amount: AMOUNT_KOBO, metadata: validMeta },
      source: "webhook",
    });
    expect(result).toBeNull();
  });

  it("returns null when plan is inactive", async () => {
    const admin = makeAdmin({ plan: { ...activePlan, is_active: false } });
    const result = await fulfillSubscriptionPayment(admin as never, {
      chargeData: { reference: "ref_001", amount: AMOUNT_KOBO, metadata: validMeta },
      source: "webhook",
    });
    expect(result).toBeNull();
  });

  it("returns null when plan creator_id does not match metadata creator_id", async () => {
    const admin = makeAdmin({ plan: { ...activePlan, creator_id: "different-creator" } });
    const result = await fulfillSubscriptionPayment(admin as never, {
      chargeData: { reference: "ref_001", amount: AMOUNT_KOBO, metadata: validMeta },
      source: "webhook",
    });
    expect(result).toBeNull();
  });

  it("returns null when plan price does not match payment amount", async () => {
    const admin = makeAdmin({ plan: { ...activePlan, price_kobo: AMOUNT_KOBO + 1000 } });
    const result = await fulfillSubscriptionPayment(admin as never, {
      chargeData: { reference: "ref_001", amount: AMOUNT_KOBO, metadata: validMeta },
      source: "webhook",
    });
    expect(result).toBeNull();
  });
});
