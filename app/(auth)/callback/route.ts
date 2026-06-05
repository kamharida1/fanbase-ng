import { NextResponse } from "next/server";

import { fetchAuthContext } from "@/lib/auth/get-auth-context";
import { getDefaultPathForRole } from "@/lib/auth/rbac";
import { canAccessPath, sanitizeNextPath } from "@/lib/auth/paths";
import { welcomeEmail } from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/send";
import { insertUserSession } from "@/lib/auth/session";
import { recordReferral } from "@/lib/referrals/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next");
  const refCode = searchParams.get("ref");
  const safeNext = sanitizeNextPath(nextRaw);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback`);
  }

  const headerStore = request.headers;
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? null;

  await insertUserSession(supabase, data.user.id, {
    userAgent: headerStore.get("user-agent"),
    ipAddress: ip,
  });

  // Detect new user (confirmed within the last 2 minutes)
  const confirmedAt = data.user.confirmed_at
    ? new Date(data.user.confirmed_at).getTime()
    : 0;
  const isNewUser = Date.now() - confirmedAt < 2 * 60 * 1000;

  // Record referral if a ref code was passed through the email link
  if (refCode && isNewUser) {
    recordReferral(createAdminClient(), {
      refereeId: data.user.id,
      refCode,
    }).catch((err) => console.error("[referral] record failed", err));
  }

  // Send welcome email to brand-new users

  if (isNewUser && data.user.email && !refCode) {
    const displayName =
      (data.user.user_metadata?.full_name as string | undefined) ??
      (data.user.user_metadata?.name as string | undefined) ??
      data.user.email.split("@")[0];

    const { subject, html } = welcomeEmail(displayName);
    sendTransactionalEmail({ to: data.user.email, subject, html }).catch(
      (err) => console.error("[email:welcome]", err),
    );
  }

  const auth = await fetchAuthContext(supabase, data.user);

  if (
    auth &&
    (auth.profile.status === "banned" || auth.profile.status === "suspended")
  ) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=account_disabled`);
  }

  let dest = "/feed";
  if (auth) {
    if (safeNext && canAccessPath(safeNext, auth.appRole)) {
      dest = safeNext;
    } else {
      dest = getDefaultPathForRole(auth.appRole);
    }
  }

  return NextResponse.redirect(`${origin}${dest}`);
}
