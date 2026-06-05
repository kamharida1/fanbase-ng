import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

export type AuditAction =
  | "payment.initialized"
  | "payment.verified"
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  | "payment.refund_failed"
  | "subscription.activated"
  | "subscription.create_skipped"
  | "subscription.renewed"
  | "subscription.past_due"
  | "subscription.cancel_scheduled"
  | "subscription.expired"
  | "subscription.revoked_refund"
  | "paystack.webhook.received"
  | "paystack.webhook.duplicate"
  | "paystack.webhook.processed"
  | "paystack.webhook.failed"
  | "paystack.webhook.signature_rejected"
  | "wallet.credited"
  | "wallet.cleared"
  | "wallet.payout_requested"
  | "wallet.reversed_refund"
  | "media.upload.confirmed"
  | "media.scan.completed"
  | "admin.user.status_updated"
  | "admin.creator.updated"
  | "admin.post.moderated"
  | "admin.report.resolved"
  | "admin.payout.reviewed"
  | "live.stream.started"
  | "live.stream.ended"
  | "payment.tip_received";

export type WriteAuditLogInput = {
  actorId?: string | null;
  actorType: "user" | "system" | "paystack";
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append-only audit trail (service role only).
 */
export async function writeAuditLog(
  admin: SupabaseClient,
  input: WriteAuditLogInput,
): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    actor_id: input.actorId ?? null,
    actor_type: input.actorType,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_state: input.beforeState ?? null,
    after_state: input.afterState ?? null,
    request_id: input.requestId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    logger.error("audit_logs.insert_failed", {
      error: error.message,
      action: input.action,
      entityId: input.entityId,
    });
  }
}
