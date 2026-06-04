"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/paths";
import { getDefaultPathForRole } from "@/lib/auth/rbac";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { canAccessPath } from "@/lib/auth/paths";
import { insertUserSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function signOutAllDevices() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("revoked_at", null);
  }

  await supabase.auth.signOut();
  redirect("/login");
}

export async function recordSession(userAgent?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? null;

  await insertUserSession(supabase, user.id, {
    userAgent: userAgent ?? headerStore.get("user-agent"),
    ipAddress: ip,
  });
}

export async function revokeSession(sessionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (error) return { error: error.message };
  return { success: true };
}

/** Role-aware redirect after successful login. */
export async function resolvePostLoginPath(
  next?: string | null,
): Promise<string> {
  const supabase = await createClient();
  const ctx = await getAuthContext(supabase);

  if (!ctx) return "/login";

  const safeNext = sanitizeNextPath(next);
  if (safeNext && canAccessPath(safeNext, ctx.appRole)) {
    return safeNext;
  }

  return getDefaultPathForRole(ctx.appRole);
}

export async function resendVerificationEmail(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/callback?next=/feed`,
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function updatePassword(newPassword: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { success: true };
}
