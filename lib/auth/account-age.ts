import type { SupabaseClient } from "@supabase/supabase-js";

const NEW_ACCOUNT_THRESHOLD_HOURS = 24;

/**
 * Returns account age in hours and whether it qualifies as "new"
 * (under 24 hours since registration).
 */
export async function getAccountAge(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ageHours: number; isNew: boolean }> {
  const { data } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .single();

  if (!data?.created_at) {
    return { ageHours: 9999, isNew: false };
  }

  const ageHours =
    (Date.now() - new Date(data.created_at).getTime()) / 3_600_000;
  return { ageHours, isNew: ageHours < NEW_ACCOUNT_THRESHOLD_HOURS };
}
