import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { asNumber, asRecord, asString } from "@/lib/paystack/parse";
import { compileDisputeEvidence } from "@/lib/payments/evidence";
import { notifyPaymentDispute } from "@/lib/notifications/emit";
import { logSubscriptionEvent } from "@/lib/subscriptions/events";
import {
  finalizeDisputeLoss,
  holdCreatorPaymentForDispute,
  releaseDisputeHold,
} from "@/lib/wallets/ledger";

const CHARGEBACK_SUSPEND_THRESHOLD = 2;

// Paystack's `resolution` values on `charge.dispute.resolve`. We only act
// automatically on unambiguous outcomes; anything else is left `open` for an
// admin to resolve manually via /admin/disputes (funds stay held either way).
const LOST_RESOLUTIONS = new Set(["merchant-accepted", "refund"]);
const WON_RESOLUTIONS = new Set(["declined", "merchant-won"]);

export async function processDisputeWebhook(
  admin: SupabaseClient,
  input: {
    event: string;
    data: Record<string, unknown>;
    requestId?: string | null;
  },
): Promise<void> {
  const transaction = asRecord(input.data.transaction);
  const reference =
    asString(transaction?.reference) ?? asString(input.data.transaction_reference);
  const paystackDisputeId = asString(input.data.id);
  const amount = asNumber(input.data.amount) ?? asNumber(transaction?.amount);
  const reason =
    asString(input.data.category) ?? asString(input.data.reason) ?? null;
  const dueAt = asString(input.data.dueAt) ?? asString(input.data.resolveBy);

  if (!reference || !paystackDisputeId) return;

  const { data: payment } = await admin
    .from("payments")
    .select("id, payer_id, creator_id, subscription_id, amount_kobo, status")
    .eq("paystack_reference", reference)
    .maybeSingle();

  if (!payment) return;

  const { data: existing } = await admin
    .from("disputes")
    .select("id, status")
    .eq("paystack_dispute_id", paystackDisputeId)
    .maybeSingle();

  if (input.event === "charge.dispute.create" || input.event === "charge.dispute.remind") {
    if (existing) return; // already opened — `remind` events don't change anything

    const { data: created, error: insertError } = await admin
      .from("disputes")
      .insert({
        payment_id: payment.id,
        paystack_dispute_id: paystackDisputeId,
        creator_id: payment.creator_id,
        fan_id: payment.payer_id,
        status: "open",
        amount_kobo: amount ?? payment.amount_kobo,
        reason,
        evidence_due_at: dueAt ? new Date(dueAt).toISOString() : null,
        metadata: { event: input.event, raw: input.data },
      })
      .select("id")
      .single();

    if (insertError || !created) {
      logger.error("disputes.insert_failed", { err: insertError, paymentId: payment.id, event: input.event });
      return;
    }

    if (payment.status !== "disputed") {
      await admin
        .from("payments")
        .update({ status: "disputed" })
        .eq("id", payment.id);
    }

    await writeAuditLog(admin, {
      actorId: payment.payer_id,
      actorType: "paystack",
      action: "payment.dispute_opened",
      entityType: "disputes",
      entityId: created.id,
      requestId: input.requestId,
      metadata: { payment_id: payment.id, paystack_dispute_id: paystackDisputeId },
    });

    if (payment.creator_id) {
      const held = await holdCreatorPaymentForDispute(admin, {
        creatorId: payment.creator_id,
        paymentId: payment.id,
        disputeId: created.id,
        idempotencyKey: `dispute:${created.id}:hold`,
      });

      if (held) {
        await writeAuditLog(admin, {
          actorId: payment.creator_id,
          actorType: "paystack",
          action: "wallet.dispute_held",
          entityType: "wallets",
          entityId: payment.creator_id,
          requestId: input.requestId,
          metadata: { payment_id: payment.id, dispute_id: created.id },
        });
      }

      await notifyPaymentDispute(admin, {
        creatorId: payment.creator_id,
        disputeId: created.id,
        status: "opened",
        amountKobo: amount ?? payment.amount_kobo,
      });
    }

    // Compile evidence snapshot asynchronously — never blocks the webhook response.
    compileDisputeEvidence(admin, {
      disputeId: created.id,
      fanId: payment.payer_id,
      creatorId: payment.creator_id,
      paymentId: payment.id,
    }).catch((err) =>
      logger.warn("disputes.evidence_compile_error", { err, disputeId: created.id }),
    );

    return;
  }

  if (input.event === "charge.dispute.resolve") {
    if (!existing || existing.status !== "open") return; // unknown or already resolved — idempotent no-op

    const resolution = asString(input.data.resolution)?.toLowerCase();
    const outcome: "won" | "lost" | null = resolution
      ? LOST_RESOLUTIONS.has(resolution)
        ? "lost"
        : WON_RESOLUTIONS.has(resolution)
          ? "won"
          : null
      : null;

    if (!outcome) {
      // Ambiguous resolution — leave the dispute open (funds stay held) for
      // an admin to resolve manually, but persist what Paystack sent us.
      await admin
        .from("disputes")
        .update({ metadata: { event: input.event, raw: input.data, needs_manual_review: true } })
        .eq("id", existing.id);
      return;
    }

    await resolveDispute(admin, {
      disputeId: existing.id,
      paymentId: payment.id,
      creatorId: payment.creator_id,
      fanId: payment.payer_id,
      subscriptionId: payment.subscription_id,
      amountKobo: amount ?? payment.amount_kobo,
      outcome,
      notes: null,
      resolvedBy: null,
      requestId: input.requestId,
      source: "paystack",
    });
  }
}

export async function resolveDispute(
  admin: SupabaseClient,
  input: {
    disputeId: string;
    paymentId: string;
    creatorId: string | null;
    fanId: string | null;
    subscriptionId: string | null;
    amountKobo: number;
    outcome: "won" | "lost" | "closed";
    notes: string | null;
    resolvedBy: string | null;
    requestId?: string | null;
    source: "paystack" | "admin";
  },
): Promise<boolean> {
  const idempotencyKey = `dispute:${input.disputeId}:${input.outcome}`;

  let walletChanged = false;
  if (input.creatorId) {
    walletChanged =
      input.outcome === "lost"
        ? await finalizeDisputeLoss(admin, {
            creatorId: input.creatorId,
            disputeId: input.disputeId,
            idempotencyKey,
          })
        : await releaseDisputeHold(admin, {
            creatorId: input.creatorId,
            disputeId: input.disputeId,
            idempotencyKey,
          });
  }

  await admin
    .from("disputes")
    .update({
      status: input.outcome,
      resolution_notes: input.notes,
      resolved_by: input.resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.disputeId);

  await writeAuditLog(admin, {
    actorId: input.resolvedBy ?? input.creatorId ?? undefined,
    actorType: input.source === "admin" ? "user" : "paystack",
    action: "payment.dispute_resolved",
    entityType: "disputes",
    entityId: input.disputeId,
    requestId: input.requestId,
    metadata: { outcome: input.outcome, payment_id: input.paymentId },
  });

  if (walletChanged && input.creatorId) {
    await writeAuditLog(admin, {
      actorId: input.creatorId,
      actorType: input.source === "admin" ? "user" : "paystack",
      action:
        input.outcome === "lost" ? "wallet.dispute_debited" : "wallet.dispute_released",
      entityType: "wallets",
      entityId: input.creatorId,
      requestId: input.requestId,
      metadata: { dispute_id: input.disputeId, payment_id: input.paymentId },
    });
  }

  // Serial chargeback enforcement: increment loss count and suspend payer if
  // they hit the threshold. We do this after the wallet is settled so the
  // suspension doesn't interfere with the financial resolution.
  if (input.outcome === "lost" && input.fanId) {
    try {
      const { data: fanRow } = await admin
        .from("profiles")
        .select("chargeback_loss_count, payment_suspended")
        .eq("id", input.fanId)
        .single();

      const newCount = (fanRow?.chargeback_loss_count ?? 0) + 1;
      const shouldSuspend =
        !fanRow?.payment_suspended && newCount >= CHARGEBACK_SUSPEND_THRESHOLD;
      const now = new Date().toISOString();

      await admin
        .from("profiles")
        .update({
          chargeback_loss_count: newCount,
          ...(shouldSuspend
            ? { payment_suspended: true, payment_suspended_at: now }
            : {}),
        })
        .eq("id", input.fanId);

      await writeAuditLog(admin, {
        actorId: input.fanId,
        actorType: "system",
        action: "payment.chargeback_loss_recorded",
        entityType: "profiles",
        entityId: input.fanId,
        metadata: {
          dispute_id: input.disputeId,
          chargeback_loss_count: newCount,
          payment_suspended: shouldSuspend,
        },
      });

      if (shouldSuspend) {
        await writeAuditLog(admin, {
          actorId: input.fanId,
          actorType: "system",
          action: "account.payment_suspended",
          entityType: "profiles",
          entityId: input.fanId,
          metadata: {
            reason: "chargeback_threshold_reached",
            threshold: CHARGEBACK_SUSPEND_THRESHOLD,
            chargeback_loss_count: newCount,
          },
        });
      }
    } catch (err) {
      logger.warn("disputes.chargeback_risk_update_failed", {
        err,
        fanId: input.fanId,
        disputeId: input.disputeId,
      });
    }
  }

  if (input.outcome === "lost" && input.subscriptionId) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, fan_id, status")
      .eq("id", input.subscriptionId)
      .maybeSingle();

    if (sub && sub.status !== "cancelled" && sub.status !== "expired") {
      await admin
        .from("subscriptions")
        .update({
          status: "cancelled",
          ended_at: new Date().toISOString(),
          cancel_at_period_end: false,
        })
        .eq("id", sub.id);

      await logSubscriptionEvent(admin, sub.id, "revoked_dispute", {
        payment_id: input.paymentId,
        dispute_id: input.disputeId,
      });

      await writeAuditLog(admin, {
        actorId: sub.fan_id,
        actorType: input.source === "admin" ? "user" : "paystack",
        action: "subscription.revoked_dispute",
        entityType: "subscriptions",
        entityId: sub.id,
        requestId: input.requestId,
        metadata: { payment_id: input.paymentId, dispute_id: input.disputeId },
      });
    }
  }

  if (input.creatorId) {
    await notifyPaymentDispute(admin, {
      creatorId: input.creatorId,
      disputeId: input.disputeId,
      status: input.outcome,
      amountKobo: input.amountKobo,
    });
  }

  return true;
}
