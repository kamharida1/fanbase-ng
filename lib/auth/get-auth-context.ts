import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { getDefaultPathForRole, resolveAppRole } from "@/lib/auth/rbac";
import type { AppRole, AuthContext, ProfileAuthRow } from "@/types/auth";
import type { UserRole } from "@/types/index";

type AdminJoinRow = {
  is_active: boolean;
  admin_roles: { slug: string } | null;
};

export async function fetchAuthContext(
  supabase: SupabaseClient,
  user: User,
): Promise<AuthContext | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, status, username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return null;

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("is_active, admin_roles(slug)")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const adminJoin = adminRow as AdminJoinRow | null;
  const adminRoleSlug = adminJoin?.admin_roles?.slug ?? null;
  const appRole = resolveAppRole(profile.role as UserRole, adminRoleSlug);

  return {
    userId: user.id,
    email: user.email,
    profile: profile as ProfileAuthRow,
    appRole,
    adminRoleSlug,
  };
}

export async function getAuthContext(
  supabase: SupabaseClient,
): Promise<AuthContext | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return fetchAuthContext(supabase, user);
}

export async function requireAuth(
  supabase: SupabaseClient,
  redirectTo = "/login",
): Promise<AuthContext> {
  const ctx = await getAuthContext(supabase);
  if (!ctx) redirect(redirectTo);
  if (ctx.profile.status === "banned" || ctx.profile.status === "suspended") {
    redirect("/login?error=account_disabled");
  }
  if (ctx.profile.status === "deleted") {
    redirect("/login?error=account_deleted");
  }
  return ctx;
}

export async function requireRole(
  supabase: SupabaseClient,
  minRole: AppRole,
): Promise<AuthContext> {
  const ctx = await requireAuth(supabase);
  const { hasMinimumRole } = await import("@/lib/auth/rbac");
  if (!hasMinimumRole(ctx.appRole, minRole)) {
    redirect(getDefaultPathForRole(ctx.appRole));
  }
  return ctx;
}
