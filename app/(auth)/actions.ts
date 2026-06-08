"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/paths";
import { getDefaultPathForRole } from "@/lib/auth/rbac";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { canAccessPath } from "@/lib/auth/paths";
import { insertUserSession } from "@/lib/auth/session";
import { mapAuthError } from "@/lib/auth/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MIN_AGE_YEARS = 18;

async function getIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function isOldEnough(dobString: string): boolean {
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  const age =
    today.getFullYear() - dob.getFullYear() -
    (today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
  return age >= MIN_AGE_YEARS;
}

export type AuthActionResult =
  | { success: true; requiresEmailVerification?: boolean }
  | { success: false; error: string; retryAfter?: number };

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthActionResult> {
  const ip = await getIp();
  const key = `authLogin:${email.trim().toLowerCase()}:${ip}`;
  const rl = await checkRateLimit(key, RATE_LIMITS.authLogin);
  if (!rl.ok) {
    return {
      success: false,
      error: `Too many login attempts. Try again in ${rl.retryAfterSeconds}s.`,
      retryAfter: rl.retryAfterSeconds,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }

  return { success: true };
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName?: string;
  username?: string;
  dateOfBirth: string;
  refCode?: string;
}): Promise<AuthActionResult> {
  const ip = await getIp();
  const key = `authSignup:${ip}`;
  const rl = await checkRateLimit(key, RATE_LIMITS.authSignup);
  if (!rl.ok) {
    return {
      success: false,
      error: `Too many signup attempts. Try again in ${rl.retryAfterSeconds}s.`,
      retryAfter: rl.retryAfterSeconds,
    };
  }

  if (!isOldEnough(input.dateOfBirth)) {
    return {
      success: false,
      error: "You must be at least 18 years old to create an account.",
    };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const refPart = input.refCode
    ? `&ref=${encodeURIComponent(input.refCode)}`
    : "";

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        display_name: input.displayName?.trim() || undefined,
        username: input.username?.trim().toLowerCase() || undefined,
        date_of_birth: input.dateOfBirth,
      },
      emailRedirectTo: `${appUrl}/callback?next=/feed${refPart}`,
    },
  });

  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }

  return {
    success: true,
    requiresEmailVerification: !data.session,
  };
}

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
