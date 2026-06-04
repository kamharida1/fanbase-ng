import type { SupabaseClient } from "@supabase/supabase-js";

export async function getProfileLabel(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("username, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return "Someone";
  return data.display_name ?? data.username ?? "Someone";
}
