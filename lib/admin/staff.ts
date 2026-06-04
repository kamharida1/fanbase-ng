import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole, AuthContext } from "@/types/auth";
import { hasMinimumRole } from "@/lib/auth/rbac";

export async function getAdminUserId(
  admin: SupabaseClient,
  profileId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("admin_users")
    .select("id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();

  return data?.id ?? null;
}

export function assertStaffRole(ctx: AuthContext, minRole: AppRole): void {
  if (!hasMinimumRole(ctx.appRole, minRole)) {
    throw new Error("Insufficient admin permissions.");
  }
}
