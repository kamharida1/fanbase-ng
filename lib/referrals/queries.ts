import type { SupabaseClient } from "@supabase/supabase-js";

export type ReferralCodeRow = {
  id: string;
  code: string;
  uses_count: number;
  is_active: boolean;
};

export type ReferralRow = {
  id: string;
  referee_id: string;
  status: string;
  qualified_at: string | null;
  rewarded_at: string | null;
  created_at: string;
  referee_username?: string | null;
};

export type ReferralStats = {
  code: string;
  totalReferrals: number;
  qualifiedReferrals: number;
  rewardedReferrals: number;
  totalEarnedKobo: number;
};

/** Derives a deterministic referral code from a user's UUID. */
export function deriveReferralCode(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Gets or creates a referral code for the user under the default program. */
export async function getOrCreateReferralCode(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReferralCodeRow | null> {
  // Try existing code first
  const { data: existing } = await supabase
    .from("referral_codes")
    .select("id, code, uses_count, is_active")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as ReferralCodeRow;

  // Look up the default program
  const { data: program } = await supabase
    .from("referral_programs")
    .select("id")
    .eq("slug", "default")
    .eq("is_active", true)
    .maybeSingle();

  if (!program) return null;

  const code = deriveReferralCode(userId);

  const { data: inserted } = await supabase
    .from("referral_codes")
    .insert({
      program_id: program.id,
      owner_id: userId,
      code,
      is_active: true,
    })
    .select("id, code, uses_count, is_active")
    .single();

  return (inserted as ReferralCodeRow) ?? null;
}

/** Looks up a referral code by its string value. */
export async function getReferralCodeByValue(
  supabase: SupabaseClient,
  code: string,
): Promise<{ id: string; owner_id: string; program_id: string } | null> {
  const { data } = await supabase
    .from("referral_codes")
    .select("id, owner_id, program_id")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();

  return data as { id: string; owner_id: string; program_id: string } | null;
}

/** Lists all referrals made by a user with referee usernames. */
export async function listReferrals(
  supabase: SupabaseClient,
  referrerId: string,
): Promise<ReferralRow[]> {
  const { data: refs } = await supabase
    .from("referrals")
    .select("id, referee_id, status, qualified_at, rewarded_at, created_at")
    .eq("referrer_id", referrerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!refs?.length) return [];

  const ids = refs.map((r) => r.referee_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", ids);

  const usernameMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  return refs.map((r) => ({
    ...r,
    referee_username: usernameMap.get(r.referee_id) ?? null,
  }));
}

/** Aggregate referral stats for a user. */
export async function getReferralStats(
  supabase: SupabaseClient,
  referrerId: string,
): Promise<{ totalReferrals: number; qualifiedReferrals: number; totalEarnedKobo: number }> {
  const { data: refs } = await supabase
    .from("referrals")
    .select("id, status")
    .eq("referrer_id", referrerId);

  const total = refs?.length ?? 0;
  const qualified = refs?.filter((r) =>
    ["qualified", "rewarded"].includes(r.status),
  ).length ?? 0;

  // Sum rewards
  const refIds = (refs ?? []).map((r) => r.id);
  let totalEarned = 0;
  if (refIds.length) {
    const { data: rewards } = await supabase
      .from("referral_rewards")
      .select("amount_kobo")
      .in("referral_id", refIds);
    totalEarned = (rewards ?? []).reduce((s, r) => s + r.amount_kobo, 0);
  }

  return { totalReferrals: total, qualifiedReferrals: qualified, totalEarnedKobo: totalEarned };
}
