import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { hasMinimumRole } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, AuthContext } from "@/types/auth";

export async function requireApiAuth(
  minRole: AppRole = "user",
): Promise<{ ctx: AuthContext } | NextResponse> {
  const supabase = await createClient();
  const ctx = await getAuthContext(supabase);

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    ctx.profile.status === "banned" ||
    ctx.profile.status === "suspended"
  ) {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }

  if (ctx.profile.status === "deleted") {
    return NextResponse.json({ error: "Account deleted" }, { status: 403 });
  }

  if (!hasMinimumRole(ctx.appRole, minRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { ctx };
}
