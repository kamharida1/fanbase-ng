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
  | "subscription.revoked_dispute"
  | "payment.dispute_opened"
  | "payment.dispute_resolved"
  | "wallet.dispute_held"
  | "wallet.dispute_released"
  | "wallet.dispute_debited"
  | "admin.dispute.resolved"
  | "appeal.submitted"
  | "admin.appeal.resolved"
  | "paystack.webhook.received"
  | "paystack.webhook.retry"
  | "paystack.webhook.duplicate"
  | "paystack.webhook.processed"
  | "paystack.webhook.failed"
  | "paystack.webhook.signature_rejected"
  | "wallet.credited"
  | "wallet.cleared"
  | "wallet.payout_requested"
  | "wallet.payout_completed"
  | "wallet.payout_failed"
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
  | "payment.tip_received"
  | "account.deletion_requested"
  | "account.deletion_cancelled"
  | "account.deletion_completed"
  | "subscription.gift_initiated"
  | "account.data_export_requested"
  | "media.content_scan.violation"
  | "admin.content_hashes.imported"
  | "admin.content_hashes.deleted"
  | "creator.velocity_flagged"
  | "creator.payout_held"
  | "copyright.claim_submitted"
  | "copyright.counter_notice_submitted"
  | "copyright.auto_removed"
  | "copyright.admin_resolved"
  | "account.signup_blocked_disposable_email"
  | "account.impersonation_reported"
  | "payment.chargeback_loss_recorded"
  | "account.payment_suspended"
  | "payment.card_sharing_flagged";

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
