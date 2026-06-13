"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/paths";
import { getDefaultPathForRole } from "@/lib/auth/rbac";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { canAccessPath } from "@/lib/auth/paths";
import { insertUserSession } from "@/lib/auth/session";
import { mapAuthError } from "@/lib/auth/errors";
import { isDisposableEmail } from "@/lib/auth/disposable-domains";
import { checkHandleForImpersonation } from "@/lib/auth/username-guard";
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

/** Sign in, record session, and resolve redirect in one request so auth cookies are available. */
export async function signInAndRedirect(
  email: string,
  password: string,
  next?: string | null,
  userAgent?: string,
): Promise<
  | { success: true; redirectTo: string }
  | { success: false; error: string; retryAfter?: number }
> {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Sign-in succeeded but the session could not be established. Please try again.",
    };
  }

  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const sessionIp = forwarded?.split(",")[0]?.trim() ?? null;

  await insertUserSession(supabase, user.id, {
    userAgent: userAgent ?? headerStore.get("user-agent"),
    ipAddress: sessionIp,
  });

  const ctx = await getAuthContext(supabase);
  if (!ctx) {
    return {
      success: false,
      error: "Your account profile could not be loaded. Contact support if this persists.",
    };
  }

  const safeNext = sanitizeNextPath(next);
  const redirectTo =
    safeNext && canAccessPath(safeNext, ctx.appRole)
      ? safeNext
      : getDefaultPathForRole(ctx.appRole);

  return { success: true, redirectTo };
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName?: string;
  username?: string;
  dateOfBirth: string;
  refCode?: string;
  honeypot?: string;
}): Promise<AuthActionResult> {
  if (input.honeypot) {
    // Bot filled a field that's hidden from real users. Pretend it worked
    // so the bot doesn't learn anything, without touching Supabase.
    return { success: true, requiresEmailVerification: true };
  }

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

  if (isDisposableEmail(input.email)) {
    return {
      success: false,
      error:
        "Temporary or disposable email addresses are not allowed. Please use a permanent email address.",
    };
  }

  if (input.username || input.displayName) {
    const guard = await checkHandleForImpersonation({
      username: input.username,
      displayName: input.displayName,
    });
    if (!guard.ok) {
      return { success: false, error: guard.reason };
    }
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
      emailRedirectTo: `${appUrl}/callback?next=/welcome${refPart}`,
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

/** Verify the signup OTP, establish the session, and resolve the post-login path. */
export async function verifySignupOtp(
  email: string,
  code: string,
  userAgent?: string,
): Promise<
  | { success: true; redirectTo: string }
  | { success: false; error: string; retryAfter?: number }
> {
  const normalizedEmail = email.trim().toLowerCase();
  const ip = await getIp();
  const key = `authVerifyOtp:${normalizedEmail}:${ip}`;
  const rl = await checkRateLimit(key, RATE_LIMITS.authVerifyOtp);
  if (!rl.ok) {
    return {
      success: false,
      error: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`,
      retryAfter: rl.retryAfterSeconds,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: code.trim(),
    type: "signup",
  });

  if (error || !data.user) {
    return {
      success: false,
      error: mapAuthError(error?.message ?? "Verification failed."),
    };
  }

  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const sessionIp = forwarded?.split(",")[0]?.trim() ?? null;

  await insertUserSession(supabase, data.user.id, {
    userAgent: userAgent ?? headerStore.get("user-agent"),
    ipAddress: sessionIp,
  });

  const ctx = await getAuthContext(supabase);
  if (!ctx) {
    return {
      success: false,
      error: "Your account profile could not be loaded. Contact support if this persists.",
    };
  }

  return { success: true, redirectTo: getDefaultPathForRole(ctx.appRole) };
}

/** Verify the password-reset OTP and set the new password in one step. */
export async function verifyRecoveryOtpAndSetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ success: true } | { success: false; error: string; retryAfter?: number }> {
  const normalizedEmail = email.trim().toLowerCase();
  const ip = await getIp();
  const key = `authVerifyOtp:${normalizedEmail}:${ip}`;
  const rl = await checkRateLimit(key, RATE_LIMITS.authVerifyOtp);
  if (!rl.ok) {
    return {
      success: false,
      error: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.`,
      retryAfter: rl.retryAfterSeconds,
    };
  }

  const supabase = await createClient();

  // Drop any existing session so the new password can only ever be applied
  // to the account proven by the OTP code, not whoever was already signed in.
  await supabase.auth.signOut();

  const { error: otpError } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: code.trim(),
    type: "recovery",
  });

  if (otpError) {
    return { success: false, error: mapAuthError(otpError.message) };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  await supabase.auth.signOut();

  if (updateError) {
    return { success: false, error: mapAuthError(updateError.message) };
  }

  return { success: true };
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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/callback?next=/welcome`,
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function requestPasswordReset(
  email: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectTo = `${appUrl}/callback?next=${encodeURIComponent("/reset-password")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo },
  );

  if (error) return { error: mapAuthError(error.message) };
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
