import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import type { ContentScanResult } from "@/lib/media/content-scan";
import type { MediaUploadRow } from "@/types/media";

type UploadRef = Pick<
  MediaUploadRow,
  "id" | "owner_id" | "context" | "context_ref_id"
>;

/**
 * Persists a content scan result, queues flagged/blocked items for moderator
 * review, and applies immediate consequences for the most severe violations.
 *
 * Callers MUST check the returned `blocked` flag and abort the confirm flow
 * when true — this function rejects the upload row but does not throw.
 */
export async function applyContentScanResult(
  admin: SupabaseClient,
  upload: UploadRef,
  result: ContentScanResult,
): Promise<{ blocked: boolean }> {
  const scanStatus =
    result.action === "block"
      ? "blocked"
      : result.action === "review"
        ? "flagged"
        : "clean";

  await admin
    .from("media_uploads")
    .update({
      content_scan_status: scanStatus,
      content_scan_action: result.action,
      content_scan_labels: result.labels,
      content_scan_sha256: result.sha256 ?? null,
      content_scan_completed_at: new Date().toISOString(),
    })
    .eq("id", upload.id);

  if (result.action === "allow") {
    return { blocked: false };
  }

  // ── Queue for moderator review ────────────────────────────────────────────
  // Priority 1000 = CSAM/hash match (top of queue); 500 = Rekognition flag.
  const priority = result.hashMatched ? 1000 : 500;
  const category = result.matchedCategory ?? result.labels[0]?.name ?? "unknown";

  await admin
    .from("moderation_queue")
    .upsert(
      {
        entity_type: "media_upload",
        entity_id: upload.id,
        post_id: upload.context === "post" ? upload.context_ref_id : null,
        priority_score: priority,
        flags: {
          auto_flagged: true,
          action: result.action,
          reason: result.reason,
          category,
          labels: result.labels,
          sha256: result.sha256,
          hash_matched: result.hashMatched,
        },
        status: "pending",
      },
      { onConflict: "entity_type,entity_id" },
    );

  // ── Audit log ─────────────────────────────────────────────────────────────
  await writeAuditLog(admin, {
    actorType: "system",
    action: "media.content_scan.violation",
    entityType: "media_uploads",
    entityId: upload.id,
    afterState: {
      scan_action: result.action,
      reason: result.reason,
      category,
      hash_matched: result.hashMatched,
    },
  });

  // ── Block path ────────────────────────────────────────────────────────────
  if (result.action === "block") {
    await admin
      .from("media_uploads")
      .update({ status: "rejected" })
      .eq("id", upload.id);

    logger.error("content.scan.blocked", {
      uploadId: upload.id,
      ownerId: upload.owner_id,
      reason: result.reason,
      hashMatched: result.hashMatched,
      matchedCategory: result.matchedCategory,
    });

    // CSAM hash match: suspend the account immediately pending human review.
    // Any other block category: leave the account active but log prominently
    // so the moderation queue review can decide whether to escalate.
    if (result.hashMatched && result.matchedCategory === "csam") {
      await admin
        .from("profiles")
        .update({ status: "suspended" })
        .eq("id", upload.owner_id);

      logger.error("content.csam_account_suspended", {
        userId: upload.owner_id,
        uploadId: upload.id,
      });
    }

    return { blocked: true };
  }

  // ── Review path ───────────────────────────────────────────────────────────
  logger.warn("content.scan.flagged_for_review", {
    uploadId: upload.id,
    ownerId: upload.owner_id,
    reason: result.reason,
    labels: result.labels.map((l) => l.name),
  });

  // Flagged uploads are allowed through but surfaced in the moderation queue.
  return { blocked: false };
}
