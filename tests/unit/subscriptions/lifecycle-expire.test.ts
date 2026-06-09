import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/subscriptions/events", () => ({
  logSubscriptionEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/notifications/emit", () => ({
  notifySubscriptionEndedFromNonPayment: vi.fn().mockResolvedValue(undefined),
}));

import { expireEndedSubscriptions } from "@/lib/subscriptions/lifecycle";

// 4 days ago — past the 3-day grace window
const EXPIRED_PERIOD_END = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
// 1 day ago — still inside the 3-day grace window
const WITHIN_GRACE_PERIOD_END = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

function makeDueRowsFetch(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        lt: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: rows }),
        }),
      }),
    }),
  };
}

function makeCancelRowsFetch(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ data: rows }),
        }),
      }),
    }),
  };
}

function makeGraceRowsFetch(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: rows }),
    }),
  };
}

function makeDueUpdateChain(updatedRows: unknown[]) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: updatedRows, error: null }),
        }),
      }),
    }),
  };
}

function makeCancelUpdateChain(updatedRows: unknown[]) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: updatedRows, error: null }),
        }),
      }),
    }),
  };
}

function makeGraceUpdateChain(updatedRows: unknown[]) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: updatedRows, error: null }),
        }),
      }),
    }),
  };
}

describe("expireEndedSubscriptions", () => {
  it("returns {expired:0, pastDue:0} when all lists are empty", async () => {
    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeDueRowsFetch([]))
        .mockReturnValueOnce(makeCancelRowsFetch([]))
        .mockReturnValueOnce(makeGraceRowsFetch([])),
    };

    const result = await expireEndedSubscriptions(supabase as never);

    expect(result).toEqual({ expired: 0, pastDue: 0 });
  });

  it("increments pastDue when optimistic lock succeeds", async () => {
    const sub = { id: "sub-1", status: "active", current_period_end: EXPIRED_PERIOD_END, cancel_at_period_end: false };

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeDueRowsFetch([sub]))
        .mockReturnValueOnce(makeDueUpdateChain([{ id: "sub-1" }]))
        .mockReturnValueOnce(makeCancelRowsFetch([]))
        .mockReturnValueOnce(makeGraceRowsFetch([])),
    };

    const result = await expireEndedSubscriptions(supabase as never);

    expect(result.pastDue).toBe(1);
    expect(result.expired).toBe(0);
  });

  it("does not increment pastDue when optimistic lock is missed (concurrent cron)", async () => {
    const sub = { id: "sub-2", status: "active", current_period_end: EXPIRED_PERIOD_END, cancel_at_period_end: false };

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeDueRowsFetch([sub]))
        .mockReturnValueOnce(makeDueUpdateChain([]))  // lock missed — another cron got it
        .mockReturnValueOnce(makeCancelRowsFetch([]))
        .mockReturnValueOnce(makeGraceRowsFetch([])),
    };

    const result = await expireEndedSubscriptions(supabase as never);

    expect(result.pastDue).toBe(0);
  });

  it("increments expired for cancel_at_period_end subscriptions", async () => {
    const sub = { id: "sub-3" };

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeDueRowsFetch([]))
        .mockReturnValueOnce(makeCancelRowsFetch([sub]))
        .mockReturnValueOnce(makeCancelUpdateChain([{ id: "sub-3" }]))
        .mockReturnValueOnce(makeGraceRowsFetch([])),
    };

    const result = await expireEndedSubscriptions(supabase as never);

    expect(result.expired).toBe(1);
    expect(result.pastDue).toBe(0);
  });

  it("increments expired for past_due subscriptions past their grace window", async () => {
    const graceRow = {
      id: "sub-4",
      fan_id: "fan-1",
      creator_id: "creator-1",
      current_period_end: EXPIRED_PERIOD_END,
      subscription_plans: { name: "Basic" },
    };

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeDueRowsFetch([]))
        .mockReturnValueOnce(makeCancelRowsFetch([]))
        .mockReturnValueOnce(makeGraceRowsFetch([graceRow]))
        .mockReturnValueOnce(makeGraceUpdateChain([{ id: "sub-4" }])),
    };

    const result = await expireEndedSubscriptions(supabase as never);

    expect(result.expired).toBe(1);
  });

  it("skips past_due subscriptions still within their grace window", async () => {
    const graceRow = {
      id: "sub-5",
      fan_id: "fan-1",
      creator_id: "creator-1",
      current_period_end: WITHIN_GRACE_PERIOD_END,
      subscription_plans: null,
    };

    const supabase = {
      from: vi.fn()
        .mockReturnValueOnce(makeDueRowsFetch([]))
        .mockReturnValueOnce(makeCancelRowsFetch([]))
        .mockReturnValueOnce(makeGraceRowsFetch([graceRow])),
    };

    const result = await expireEndedSubscriptions(supabase as never);

    expect(result.expired).toBe(0);
  });
});
