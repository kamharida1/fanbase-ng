import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit/log";

// NDPR Article 5: right to data portability. Returns a JSON snapshot of all
// personal data the platform holds for the authenticated user.
export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const ctx = await getAuthContext(supabase);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ctx.userId;

  const rl = await checkRateLimit(`data_export:${userId}`, RATE_LIMITS.paymentVerify);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const admin = createAdminClient();

  const [
    { data: profile },
    { data: subscriptions },
    { data: payments },
    { data: notifications },
    { data: posts },
    { data: notificationPrefs },
  ] = await Promise.all([
    admin.from("profiles").select("id, username, display_name, role, status, created_at").eq("id", userId).maybeSingle(),
    admin.from("subscriptions").select("id, creator_id, plan_id, status, billing_interval, current_period_start, current_period_end, created_at").eq("fan_id", userId),
    admin.from("payments").select("id, amount_kobo, currency, type, status, created_at").eq("payer_id", userId),
    admin.from("notifications").select("id, type, title, body, read, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
    admin.from("posts").select("id, type, caption, status, created_at").eq("creator_id", userId),
    admin.from("notification_preferences").select("email_enabled, push_enabled, digest_enabled, preferences").eq("user_id", userId).maybeSingle(),
  ]);

  const { data: authUser } = await admin.auth.admin.getUserById(userId);

  await writeAuditLog(admin, {
    actorId: userId,
    actorType: "user",
    action: "account.data_export_requested",
    entityType: "profiles",
    entityId: userId,
  });

  const exportData = {
    exported_at: new Date().toISOString(),
    account: {
      id: userId,
      email: authUser?.user?.email,
      email_confirmed_at: authUser?.user?.email_confirmed_at,
      created_at: authUser?.user?.created_at,
    },
    profile,
    notification_preferences: notificationPrefs,
    subscriptions: subscriptions ?? [],
    payments: payments ?? [],
    notifications: notifications ?? [],
    posts: posts ?? [],
  };

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="fanbaseng-data-export-${userId}.json"`,
      "Content-Type": "application/json",
    },
  });
}
