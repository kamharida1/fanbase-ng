import { NextResponse } from "next/server";

import { fetchAuthContext } from "@/lib/auth/get-auth-context";
import { getDefaultPathForRole } from "@/lib/auth/rbac";
import { canAccessPath, sanitizeNextPath } from "@/lib/auth/paths";
import { insertUserSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next");
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
