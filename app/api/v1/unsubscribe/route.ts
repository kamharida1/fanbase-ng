import { NextResponse } from "next/server";

import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://fanbaseng.com";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/settings/notifications?unsubscribe=invalid`);
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    return NextResponse.redirect(`${APP_URL}/settings/notifications?unsubscribe=invalid`);
  }

  const admin = createAdminClient();

  // Upsert so the row is created if the user has no preferences row yet.
  await admin
    .from("notification_preferences")
    .upsert({ user_id: userId, email_enabled: false }, { onConflict: "user_id" });

  return NextResponse.redirect(`${APP_URL}/settings/notifications?unsubscribe=success`);
}
