import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/get-auth-context";
import type { AppRole, AuthContext } from "@/types/auth";

export async function requireAdminStaff(
  minRole: AppRole = "moderator",
): Promise<AuthContext> {
  const supabase = await createClient();
  return requireRole(supabase, minRole);
}
