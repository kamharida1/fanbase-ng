import type { SupabaseClient } from "@supabase/supabase-js";

import { requireRole } from "@/lib/auth/get-auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function createStaffAdminClient(): Promise<SupabaseClient> {
  const supabase = await createClient();
  await requireRole(supabase, "moderator");
  return createAdminClient();
}
