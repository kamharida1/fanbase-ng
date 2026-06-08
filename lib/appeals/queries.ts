import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountAppealRow = {
  id: string;
  status: "pending" | "approved" | "denied";
  account_status_at_submission: string;
  message: string;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
};

export async function getMyLatestAppeal(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountAppealRow | null> {
  const { data, error } = await supabase
    .from("account_appeals")
    .select(
      "id, status, account_status_at_submission, message, admin_notes, resolved_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as AccountAppealRow;
}
