import type { SupabaseClient } from "@supabase/supabase-js";

import { KYC_AUTO_MIN_ACCOUNT_DAYS, KYC_AUTO_MIN_NOTE_LENGTH } from "@/lib/wallets/payout-automation/constants";

export type KycAutoDecision = {
  eligible: boolean;
  reasons: string[];
};

const SPAM_PATTERNS = [/(.)\1{8,}/i, /https?:\/\//i, /(.{1,10})\1{4,}/i];

export async function evaluateKycAutoApproval(
  admin: SupabaseClient,
  creatorId: string,
): Promise<KycAutoDecision> {
  const reasons: string[] = [];

  const [profileResult, creatorResult, postsResult, bankResult, reportsResult, velocityResult, authResult] =
    await Promise.all([
      admin
        .from("profiles")
        .select("kyc_status, verification_note, avatar_url, created_at")
        .eq("id", creatorId)
        .maybeSingle(),
      admin
        .from("creator_profiles")
        .select("bio")
        .eq("user_id", creatorId)
        .maybeSingle(),
      admin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creatorId)
        .eq("status", "published"),
      admin
        .from("payout_accounts")
        .select("id", { count: "exact", head: true })
        .eq("creator_id", creatorId)
        .eq("is_verified", true),
      admin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("reported_user_id", creatorId)
        .in("status", ["open", "reviewing"]),
      admin
        .from("moderation_queue")
        .select("flags")
        .eq("entity_type", "creator")
        .eq("entity_id", creatorId)
        .maybeSingle(),
      admin.auth.admin.getUserById(creatorId),
    ]);

  const profile = profileResult.data;
  if (!profile || profile.kyc_status !== "pending") {
    return { eligible: false, reasons: ["not pending review"] };
  }

  const note = profile.verification_note?.trim() ?? "";
  if (note.length < KYC_AUTO_MIN_NOTE_LENGTH) {
    reasons.push("verification note is too short");
  }
  if (SPAM_PATTERNS.some((pattern) => pattern.test(note))) {
    reasons.push("verification note looks automated or spammy");
  }
  if (!profile.avatar_url?.trim()) {
    reasons.push("profile photo is missing");
  }
  if (!creatorResult.data?.bio?.trim()) {
    reasons.push("bio is missing");
  }
  if ((postsResult.count ?? 0) < 1) {
    reasons.push("no published posts yet");
  }
  if ((bankResult.count ?? 0) < 1) {
    reasons.push("no verified payout bank account");
  }
  if ((reportsResult.count ?? 0) > 0) {
    reasons.push("open moderation reports");
  }

  const velocityFlagged = Boolean(
    velocityResult.data?.flags &&
      typeof velocityResult.data.flags === "object" &&
      (velocityResult.data.flags as { velocity_alert?: boolean }).velocity_alert,
  );
  if (velocityFlagged) {
    reasons.push("account flagged for manual earnings review");
  }

  const createdAt = profile.created_at ? new Date(profile.created_at) : null;
  const accountAgeDays = createdAt
    ? (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
    : 0;
  if (accountAgeDays < KYC_AUTO_MIN_ACCOUNT_DAYS) {
    reasons.push("account is newer than the auto-approval window");
  }

  const emailConfirmed = Boolean(authResult.data.user?.email_confirmed_at);
  if (!emailConfirmed) {
    reasons.push("email address is not confirmed");
  }

  return { eligible: reasons.length === 0, reasons };
}

export async function tryAutoApproveKyc(
  admin: SupabaseClient,
  creatorId: string,
): Promise<{ approved: boolean; reasons: string[] }> {
  const decision = await evaluateKycAutoApproval(admin, creatorId);
  if (!decision.eligible) {
    return { approved: false, reasons: decision.reasons };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      kyc_status: "verified",
      verification_rejected_reason: null,
    })
    .eq("id", creatorId)
    .eq("kyc_status", "pending");

  if (profileError) {
    return { approved: false, reasons: [profileError.message] };
  }

  await admin
    .from("creator_profiles")
    .update({ is_verified: true })
    .eq("user_id", creatorId);

  try {
    const { notifyKycDecision } = await import("@/lib/notifications/emit");
    await notifyKycDecision(admin, {
      creatorId,
      outcome: "approved",
    });
  } catch {
    // best-effort
  }

  return { approved: true, reasons: [] };
}

export async function autoApprovePendingKyc(
  admin: SupabaseClient,
  limit = 25,
): Promise<{ approved: number; skipped: number }> {
  const { data: pending } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "creator")
    .eq("kyc_status", "pending")
    .order("updated_at", { ascending: true })
    .limit(limit);

  let approved = 0;
  let skipped = 0;

  for (const row of pending ?? []) {
    const result = await tryAutoApproveKyc(admin, row.id);
    if (result.approved) approved += 1;
    else skipped += 1;
  }

  return { approved, skipped };
}
