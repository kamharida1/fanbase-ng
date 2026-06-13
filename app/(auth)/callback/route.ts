import { type NextRequest, NextResponse } from "next/server";

import { fetchAuthContext } from "@/lib/auth/get-auth-context";
import { getDefaultPathForRole } from "@/lib/auth/rbac";
import { canAccessPath, sanitizeNextPath } from "@/lib/auth/paths";
import { welcomeEmail } from "@/lib/email/templates";
import { sendTransactionalEmail } from "@/lib/email/send";
import { insertUserSession } from "@/lib/auth/session";
import { recordReferral } from "@/lib/referrals/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next");
  const refCode = searchParams.get("ref");
  const safeNext = sanitizeNextPath(nextRaw);

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback`);
  }

  const { supabase, applyCookies } = createRouteHandlerClient(request);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    const isPkce =
      error?.message.toLowerCase().includes("code verifier") ||
      error?.message.toLowerCase().includes("pkce");
    const errParam = isPkce ? "auth_callback_pkce" : "auth_callback";
    return NextResponse.redirect(`${origin}/login?error=${errParam}`);
  }

  const headerStore = request.headers;
  const forwarded = headerStore.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? null;

  await insertUserSession(supabase, data.user.id, {
    userAgent: headerStore.get("user-agent"),
    ipAddress: ip,
  });

  const confirmedAt = data.user.confirmed_at
    ? new Date(data.user.confirmed_at).getTime()
    : 0;
  const isNewUser = Date.now() - confirmedAt < 2 * 60 * 1000;

  if (refCode && isNewUser) {
    recordReferral(createAdminClient(), {
      refereeId: data.user.id,
      refCode,
    }).catch((err) => console.error("[referral] record failed", err));
  }

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
    return applyCookies(
      NextResponse.redirect(`${origin}/login?error=account_disabled`),
    );
  }

  let dest = "/feed";
  if (safeNext && (!auth || canAccessPath(safeNext, auth.appRole))) {
    dest = safeNext;
  } else if (auth) {
    dest = getDefaultPathForRole(auth.appRole);
  }

  return applyCookies(NextResponse.redirect(`${origin}${dest}`));
}
