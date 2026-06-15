import { describe, expect, it } from "vitest";

import { assessPayoutRisk } from "@/lib/wallets/payout-automation/risk";

describe("assessPayoutRisk", () => {
  it("auto-approves low-risk verified payouts", () => {
    const result = assessPayoutRisk({
      creatorId: "c1",
      netAmountKobo: 5_000_000,
      kycStatus: "verified",
      walletHeldKobo: 0,
      walletDebtKobo: 0,
      openDisputes: 0,
      hasRecipient: true,
      firstSubscriberPaidAt: null,
      completedPayoutCount: 2,
      velocityFlagged: false,
    });

    expect(result.autoApprovable).toBe(true);
    expect(result.requiresReview).toBe(false);
  });

  it("requires review when KYC is missing", () => {
    const result = assessPayoutRisk({
      creatorId: "c1",
      netAmountKobo: 5_000_000,
      kycStatus: "pending",
      walletHeldKobo: 0,
      walletDebtKobo: 0,
      openDisputes: 0,
      hasRecipient: true,
      firstSubscriberPaidAt: null,
      completedPayoutCount: 0,
      velocityFlagged: false,
    });

    expect(result.autoApprovable).toBe(false);
    expect(result.reasons.some((r) => r.includes("identity verification"))).toBe(true);
  });

  it("requires review for large withdrawals", () => {
    const result = assessPayoutRisk({
      creatorId: "c1",
      netAmountKobo: 50_000_000,
      kycStatus: "verified",
      walletHeldKobo: 0,
      walletDebtKobo: 0,
      openDisputes: 0,
      hasRecipient: true,
      firstSubscriberPaidAt: null,
      completedPayoutCount: 3,
      velocityFlagged: false,
    });

    expect(result.requiresReview).toBe(true);
    expect(result.reasons.some((r) => r.includes("automatic approval limit"))).toBe(true);
  });
});
