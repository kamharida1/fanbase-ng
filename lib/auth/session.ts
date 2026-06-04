import type { SupabaseClient } from "@supabase/supabase-js";

export async function insertUserSession(
  supabase: SupabaseClient,
  userId: string,
  options?: { userAgent?: string | null; ipAddress?: string | null },
) {
  const { error } = await supabase.from("user_sessions").insert({
    user_id: userId,
    user_agent: options?.userAgent ?? null,
    ip_address: options?.ipAddress ?? null,
  });

  if (error) {
    console.error("[auth] failed to record session:", error.message);
  }
}

export async function touchUserSession(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: latest } = await supabase
    .from("user_sessions")
    .select("id")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.id) {
    await supabase
      .from("user_sessions")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", latest.id);
  }
}
