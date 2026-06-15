import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FIRST_WITHDRAWAL_HOLD_DAYS,
  PAYOUT_AUTO_APPROVE_MAX_KOBO,
} from "@/lib/wallets/payout-automation/constants";

export type PayoutRiskAssessment = {
  autoApprovable: boolean;
  requiresReview: boolean;
  reasons: string[];
};

type PayoutContext = {
  creatorId: string;
  netAmountKobo: number;
  kycStatus: string | null;
  walletHeldKobo: number;
  walletDebtKobo: number;
  openDisputes: number;
  hasRecipient: boolean;
  firstSubscriberPaidAt: string | null;
  completedPayoutCount: number;
  velocityFlagged: boolean;
};

export async function loadPayoutContext(
  admin: SupabaseClient,
  input: { creatorId: string; netAmountKobo: number; payoutAccountId: string },
): Promise<PayoutContext> {
  const [
    profileResult,
    walletResult,
    disputesResult,
    accountResult,
    creatorResult,
    completedResult,
    velocityResult,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("kyc_status")
      .eq("id", input.creatorId)
      .maybeSingle(),
    admin
      .from("wallets")
      .select("held_kobo, debt_kobo")
      .eq("owner_id", input.creatorId)
      .eq("owner_type", "creator")
      .maybeSingle(),
    admin
      .from("disputes")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", input.creatorId)
      .eq("status", "open"),
    admin
      .from("payout_accounts")
      .select("paystack_recipient_code")
      .eq("id", input.payoutAccountId)
      .maybeSingle(),
    admin
      .from("creator_profiles")
      .select("first_subscriber_paid_at")
      .eq("user_id", input.creatorId)
      .maybeSingle(),
    admin
      .from("payout_requests")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", input.creatorId)
      .eq("status", "completed"),
    admin
      .from("moderation_queue")
      .select("flags")
      .eq("entity_type", "creator")
      .eq("entity_id", input.creatorId)
      .maybeSingle(),
  ]);

  const velocityFlagged = Boolean(
    velocityResult.data?.flags &&
      typeof velocityResult.data.flags === "object" &&
      (velocityResult.data.flags as { velocity_alert?: boolean }).velocity_alert,
  );

  return {
    creatorId: input.creatorId,
    netAmountKobo: input.netAmountKobo,
    kycStatus: profileResult.data?.kyc_status ?? null,
    walletHeldKobo: walletResult.data?.held_kobo ?? 0,
    walletDebtKobo: walletResult.data?.debt_kobo ?? 0,
    openDisputes: disputesResult.count ?? 0,
    hasRecipient: Boolean(accountResult.data?.paystack_recipient_code),
    firstSubscriberPaidAt: creatorResult.data?.first_subscriber_paid_at ?? null,
    completedPayoutCount: completedResult.count ?? 0,
    velocityFlagged,
  };
}

export function assessPayoutRisk(ctx: PayoutContext): PayoutRiskAssessment {
  const reasons: string[] = [];

  if (ctx.kycStatus !== "verified") {
    reasons.push("identity verification is not complete");
  }
  if (!ctx.hasRecipient) {
    reasons.push("your bank account is not linked to Paystack yet");
  }
  if (ctx.openDisputes > 0) {
    reasons.push("you have an open payment dispute");
  }
  if (ctx.walletDebtKobo > 0) {
    reasons.push("your wallet has an outstanding balance from refunds");
  }
  if (ctx.walletHeldKobo > 0) {
    reasons.push("some earnings are on hold while a dispute is resolved");
  }
  if (ctx.netAmountKobo > PAYOUT_AUTO_APPROVE_MAX_KOBO) {
    reasons.push("this withdrawal exceeds the automatic approval limit");
  }
  if (ctx.velocityFlagged) {
    reasons.push("your account is flagged for a manual earnings review");
  }

  if (ctx.firstSubscriberPaidAt) {
    const holdUntil = new Date(ctx.firstSubscriberPaidAt);
    holdUntil.setUTCDate(holdUntil.getUTCDate() + FIRST_WITHDRAWAL_HOLD_DAYS);
    if (holdUntil > new Date()) {
      reasons.push("your first withdrawal is in the one-time security hold period");
    }
  }

  const requiresReview = reasons.length > 0;
  const autoApprovable = !requiresReview;

  return { autoApprovable, requiresReview, reasons };
}

export function formatPayoutReviewReasons(reasons: string[]): string {
  if (reasons.length === 0) {
    return "This withdrawal needs a quick manual review before we send it to your bank.";
  }
  if (reasons.length === 1) {
    return `This withdrawal needs manual review because ${reasons[0]}.`;
  }
  return `This withdrawal needs manual review because ${reasons.slice(0, -1).join(", ")} and ${reasons.at(-1)}.`;
}
