import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { notifyCopyrightAutoRemoved } from "@/lib/notifications/emit";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BATCH_SIZE = 50;

export async function POST(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Find all overdue claims: window expired, no counter-notice
  const { data: overdue } = await admin
    .from("copyright_claims")
    .select("id, post_id, claimant_email")
    .eq("status", "pending_counter_notice")
    .lte("counter_notice_deadline", nowIso)
    .limit(BATCH_SIZE);

  let removed = 0;

  for (const claim of overdue ?? []) {
    try {
      // Fetch post and creator details for the notification
      const { data: post } = await admin
        .from("posts")
        .select("id, title, creator_id, status")
        .eq("id", claim.post_id)
        .maybeSingle();

      if (!post || post.status === "removed") {
        // Already removed — just close the claim
        await admin
          .from("copyright_claims")
          .update({ status: "resolved_removed", resolved_at: nowIso })
          .eq("id", claim.id);
        continue;
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("display_name, username")
        .eq("id", post.creator_id)
        .maybeSingle();

      const creatorName =
        profile?.display_name ?? profile?.username ?? "Creator";

      // Remove the post
      await admin
        .from("posts")
        .update({ status: "removed", removed_at: nowIso })
        .eq("id", post.id);

      // Close the claim
      await admin
        .from("copyright_claims")
        .update({ status: "resolved_removed", resolved_at: nowIso })
        .eq("id", claim.id);

      // Resolve moderation queue entry
      await admin
        .from("moderation_queue")
        .update({ status: "resolved" })
        .eq("entity_type", "post")
        .eq("entity_id", post.id);

      await writeAuditLog(admin, {
        actorId: null,
        actorType: "system",
        action: "copyright.auto_removed",
        entityType: "posts",
        entityId: post.id,
        afterState: { claim_id: claim.id, reason: "counter_notice_deadline_expired" },
      });

      await notifyCopyrightAutoRemoved(admin, {
        creatorId: post.creator_id,
        creatorName,
        postTitle: post.title ?? "Untitled post",
        claimId: claim.id,
      });

      removed++;
    } catch (err) {
      logger.error("dmca.auto_remove_failed", { err, claimId: claim.id });
    }
  }

  return NextResponse.json({ removed });
}
