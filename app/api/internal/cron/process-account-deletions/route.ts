import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import { notifyAccountDeletion } from "@/lib/notifications/emit";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

function anonymizedUsername(userId: string): string {
  return `deleted-${userId.replace(/-/g, "").slice(0, 12)}`;
}

export async function POST(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("profiles")
    .select("id, role")
    .not("deletion_scheduled_for", "is", null)
    .lte("deletion_scheduled_for", nowIso)
    .is("deleted_at", null);

  let completed = 0;

  for (const profile of due ?? []) {
    try {
      // Cancel subscriptions where this user is the fan — they lose access immediately.
      await admin
        .from("subscriptions")
        .update({ status: "cancelled", ended_at: nowIso })
        .eq("fan_id", profile.id)
        .in("status", ["active", "trialing", "past_due", "paused"]);

      // Cancel subscriptions where this user is the creator — their subscribers lose access too.
      if (profile.role === "creator") {
        await admin
          .from("subscriptions")
          .update({ status: "cancelled", ended_at: nowIso })
          .eq("creator_id", profile.id)
          .in("status", ["active", "trialing", "past_due", "paused"]);

        await admin
          .from("creator_profiles")
          .update({ bio: null, banner_url: null, social_links: {}, is_accepting_subscribers: false })
          .eq("user_id", profile.id);
      }

      // Send the completion notice before anonymizing — it still resolves the
      // account's email via auth.users (which we deliberately don't delete).
      await notifyAccountDeletion(admin, { userId: profile.id, stage: "completed" });

      await admin
        .from("profiles")
        .update({
          username: anonymizedUsername(profile.id),
          display_name: null,
          avatar_url: null,
          phone: null,
          status: "deleted",
          deleted_at: nowIso,
          deletion_requested_at: null,
          deletion_scheduled_for: null,
        })
        .eq("id", profile.id);

      await writeAuditLog(admin, {
        actorId: null,
        actorType: "system",
        action: "account.deletion_completed",
        entityType: "profiles",
        entityId: profile.id,
        afterState: { status: "deleted" },
      });

      completed += 1;
    } catch (err) {
      console.error("[process-account-deletions]", profile.id, err);
    }
  }

  return NextResponse.json({ ok: true, due: due?.length ?? 0, completed });
}
