"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { creditCreatorFromPayment } from "@/lib/wallets/ledger";
import { getReferralCodeByValue } from "@/lib/referrals/queries";

/**
 * Called from the auth callback when a new user signs up via a referral link.
 * Creates the referrals row linking referee → referrer.
 * Safe to call multiple times — the UNIQUE constraint on referee_id prevents duplicates.
 */
export async function recordReferral(
  admin: SupabaseClient,
  input: { refereeId: string; refCode: string },
): Promise<void> {
  const codeRow = await getReferralCodeByValue(admin, input.refCode);
  if (!codeRow) return;

  // Self-referral guard
  if (codeRow.owner_id === input.refereeId) return;

  // Create the referral (UNIQUE on referee_id prevents duplicates)
  await admin
    .from("referrals")
    .upsert(
      {
        program_id: codeRow.program_id,
        referral_code_id: codeRow.id,
        referrer_id: codeRow.owner_id,
        referee_id: input.refereeId,
        status: "pending",
      },
      { onConflict: "referee_id", ignoreDuplicates: true },
    );

  // Atomic increment — function defined in 20260620000001_security_hardening.sql
  void Promise.resolve(
    admin.rpc("increment_referral_code_uses", { p_code_id: codeRow.id }),
  );
}

/**
 * Called when a referred user makes their FIRST successful subscription payment.
 * Credits the referrer's wallet and marks the referral as rewarded.
 * Idempotent — checks rewarded_at before proceeding.
 */
export async function qualifyAndRewardReferral(input: {
  refereeId: string;
  paymentId: string;
  paymentAmountKobo: number;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: referral } = await admin
    .from("referrals")
    .select("id, referrer_id, status, program_id, rewarded_at")
    .eq("referee_id", input.refereeId)
    .eq("status", "pending")
    .maybeSingle();

  if (!referral || referral.rewarded_at) return;

  const { data: program } = await admin
    .from("referral_programs")
    .select("referrer_reward_bps")
    .eq("id", referral.program_id)
    .maybeSingle();

  const bps = program?.referrer_reward_bps ?? 500;
  const rewardKobo = Math.max(
    Math.round((input.paymentAmountKobo * bps) / 10_000),
    100, // minimum ₦1
  );

  // Mark as rewarded atomically
  const { error: updateErr } = await admin
    .from("referrals")
    .update({
      status: "rewarded",
      qualified_at: new Date().toISOString(),
      rewarded_at: new Date().toISOString(),
    })
    .eq("id", referral.id)
    .eq("status", "pending"); // optimistic lock

  if (updateErr) return; // already processed

  // Credit referrer's wallet
  try {
    const idempotencyKey = `referral:${referral.id}:reward`;
    await creditCreatorFromPayment(admin, {
      creatorId: referral.referrer_id,
      paymentId: input.paymentId,
      grossKobo: rewardKobo,
      idempotencyKey,
      description: "Referral reward",
    });

    // Record the reward row
    await admin.from("referral_rewards").insert({
      referral_id: referral.id,
      amount_kobo: rewardKobo,
    });

    await writeAuditLog(admin, {
      actorId: referral.referrer_id,
      actorType: "system",
      action: "payment.tip_received", // reuse closest existing action
      entityType: "referrals",
      entityId: referral.id,
      metadata: { reward_kobo: rewardKobo, referee_id: input.refereeId },
    });
  } catch (err) {
    console.error("[referral] reward credit failed", err);
  }
}
