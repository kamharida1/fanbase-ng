import { beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchPaystackWebhook } from "@/lib/paystack/webhook-handler";

// ── audit log ────────────────────────────────────────────────────────────────
const auditLog = vi.fn();
vi.mock("@/lib/audit/log", () => ({ writeAuditLog: (...a: unknown[]) => auditLog(...a) }));

// ── other dispatch paths we don't care about here ────────────────────────────
vi.mock("@/lib/payments/processor", () => ({
  fulfillSubscriptionPayment: vi.fn(),
  failSubscriptionPayment: vi.fn(),
  recordSubscriptionRenewal: vi.fn(),
}));
vi.mock("@/lib/payments/ppv-processor", () => ({
  fulfillPpvPurchase: vi.fn(),
}));
vi.mock("@/lib/payments/refunds", () => ({
  processRefundWebhook: vi.fn(),
}));
vi.mock("@/lib/subscriptions/events", () => ({
  logSubscriptionEvent: vi.fn(),
}));

// ── Supabase admin mock factory ───────────────────────────────────────────────
function makeAdmin({
  planRow = null as { id: string } | null,
  userEmail = null as string | null,
  sub = null as { id: string; fan_id: string; paystack_subscription_code: string | null } | null,
} = {}) {
  const updateSub = vi.fn().mockResolvedValue({ error: null });

  // Build a chainable mock that returns the right terminal value per table.
  // subscription_plans: .select().eq().maybeSingle()
  // subscriptions (select): .select().eq().eq().order().limit().maybeSingle()
  // subscriptions (update): .update().eq()
  const fromImpl = (table: string) => {
    if (table === "subscription_plans") {
      const terminal = { maybeSingle: () => Promise.resolve({ data: planRow }) };
      return { select: () => ({ eq: () => terminal }) };
    }
    if (table === "subscriptions") {
      const terminal = { maybeSingle: () => Promise.resolve({ data: sub }) };
      const withLimit = { limit: () => terminal };
      const withOrder = { order: () => withLimit };
      const withEq2 = { eq: () => withOrder };
      const withEq1 = { eq: () => withEq2 };
      return {
        select: () => withEq1,
        update: () => ({ eq: updateSub }),
      };
    }
    return { select: vi.fn(), update: vi.fn() };
  };

  const admin = {
    from: vi.fn((t: string) => fromImpl(t)),
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: {
            users: userEmail ? [{ id: "user-123", email: userEmail }] : [],
          },
        }),
      },
    },
  };

  return { admin, updateSub };
}

const BASE_EVENT = {
  subscription_code: "SUB_abc",
  plan: { plan_code: "PLN_xyz" },
  customer: { email: "fan@example.com" },
};

describe("dispatchPaystackWebhook — subscription.create", () => {
  beforeEach(() => {
    auditLog.mockClear();
  });

  it("skips and logs audit when plan_code is missing", async () => {
    const { admin } = makeAdmin();
    await dispatchPaystackWebhook(
      admin as never,
      { event: "subscription.create", data: { subscription_code: "SUB_1", customer: { email: "a@b.com" } } },
      "req-1",
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "subscription.create_skipped" }),
    );
    expect(admin.from).not.toHaveBeenCalledWith("subscriptions");
  });

  it("skips and logs audit when customer email is missing", async () => {
    const { admin } = makeAdmin();
    await dispatchPaystackWebhook(
      admin as never,
      { event: "subscription.create", data: { subscription_code: "SUB_1", plan: { plan_code: "PLN_x" } } },
      "req-2",
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "subscription.create_skipped" }),
    );
  });

  it("returns without update when plan is not found in DB", async () => {
    const { admin, updateSub } = makeAdmin({ planRow: null, userEmail: "fan@example.com" });
    await dispatchPaystackWebhook(
      admin as never,
      { event: "subscription.create", data: BASE_EVENT },
      "req-3",
    );
    expect(updateSub).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns without update when user email is not found", async () => {
    const { admin, updateSub } = makeAdmin({
      planRow: { id: "plan-1" },
      userEmail: null,
    });
    await dispatchPaystackWebhook(
      admin as never,
      { event: "subscription.create", data: BASE_EVENT },
      "req-4",
    );
    expect(updateSub).not.toHaveBeenCalled();
  });

  it("returns without update when no matching subscription exists", async () => {
    const { admin, updateSub } = makeAdmin({
      planRow: { id: "plan-1" },
      userEmail: "fan@example.com",
      sub: null,
    });
    await dispatchPaystackWebhook(
      admin as never,
      { event: "subscription.create", data: BASE_EVENT },
      "req-5",
    );
    expect(updateSub).not.toHaveBeenCalled();
  });

  it("skips update when subscription already has the same code (idempotent)", async () => {
    const { admin, updateSub } = makeAdmin({
      planRow: { id: "plan-1" },
      userEmail: "fan@example.com",
      sub: { id: "sub-1", fan_id: "user-123", paystack_subscription_code: "SUB_abc" },
    });
    await dispatchPaystackWebhook(
      admin as never,
      { event: "subscription.create", data: BASE_EVENT },
      "req-6",
    );
    expect(updateSub).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("updates subscription code and writes audit log on a clean match", async () => {
    const { admin, updateSub } = makeAdmin({
      planRow: { id: "plan-1" },
      userEmail: "fan@example.com",
      sub: { id: "sub-1", fan_id: "user-123", paystack_subscription_code: null },
    });
    await dispatchPaystackWebhook(
      admin as never,
      { event: "subscription.create", data: BASE_EVENT },
      "req-7",
    );
    expect(updateSub).toHaveBeenCalledWith("id", "sub-1");
    expect(auditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "subscription.activated",
        entityId: "sub-1",
        metadata: expect.objectContaining({ paystack_subscription_code: "SUB_abc" }),
      }),
    );
  });
});
