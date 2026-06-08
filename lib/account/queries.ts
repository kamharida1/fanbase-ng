import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountDeletionStatus = {
  deletion_requested_at: string | null;
  deletion_scheduled_for: string | null;
};

export async function getAccountDeletionStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountDeletionStatus | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("deletion_requested_at, deletion_scheduled_for")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as AccountDeletionStatus;
}
