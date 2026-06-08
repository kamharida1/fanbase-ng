"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { getAdminUserId, assertStaffRole } from "@/lib/admin/staff";
import {
  adminCreatorUpdateSchema,
  adminModeratePostSchema,
  adminPayoutReviewSchema,
  adminResolveAppealSchema,
  adminResolveDisputeSchema,
  adminResolveReportSchema,
  adminUserStatusSchema,
} from "@/lib/admin/schemas";
import { requireAdminStaff } from "@/lib/admin/require";
import {
  notifyAccountStatusChange,
  notifyAppealResolved,
} from "@/lib/notifications/emit";
import { resolveDispute } from "@/lib/payments/disputes";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminActionResult =
  | { success: true }
  | { success: false; error: string };

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/creators");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/disputes");
  revalidatePath("/admin/appeals");
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/audit");
}

async function logAdminAction(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    afterState?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  },
) {
  await writeAuditLog(admin, {
    actorId: input.actorId,
    actorType: "user",
    action: input.action as never,
    entityType: input.entityType,
    entityId: input.entityId,
    afterState: input.afterState,
    metadata: input.metadata,
  });
}

export async function adminUpdateUserStatus(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = adminUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const ctx = await requireAdminStaff("admin");
    const admin = createAdminClient();

    const { error } = await admin
      .from("profiles")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.userId);

    if (error) return { success: false, error: error.message };

    await logAdminAction(admin, {
      actorId: ctx.userId,
      action: "admin.user.status_updated",
      entityType: "profiles",
      entityId: parsed.data.userId,
      afterState: { status: parsed.data.status },
    });

    if (
      parsed.data.status === "suspended" ||
      parsed.data.status === "banned" ||
      parsed.data.status === "active"
    ) {
      void notifyAccountStatusChange(admin, {
        userId: parsed.data.userId,
        status: parsed.data.status,
      }).catch((err) => console.error("[notify:account_status]", err));
    }

    revalidateAdmin();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Update failed.",
    };
  }
}

export async function adminUpdateCreator(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = adminCreatorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const ctx = await requireAdminStaff("admin");
    const admin = createAdminClient();

    const creatorPayload: Record<string, unknown> = {};
    const profilePayload: Record<string, unknown> = {};

    if (parsed.data.isVerified !== undefined) {
      creatorPayload.is_verified = parsed.data.isVerified;
    }
    if (parsed.data.isAcceptingSubscribers !== undefined) {
      creatorPayload.is_accepting_subscribers = parsed.data.isAcceptingSubscribers;
    }
    if (parsed.data.feedPriority !== undefined) {
      creatorPayload.feed_priority = parsed.data.feedPriority;
    }
    if (parsed.data.approveVerification) {
      creatorPayload.is_verified = true;
      profilePayload.kyc_status = "verified";
      profilePayload.verification_rejected_reason = null;
    }
    if (parsed.data.rejectVerification) {
      profilePayload.kyc_status = "rejected";
      profilePayload.verification_rejected_reason = parsed.data.rejectionReason ?? "Your request did not meet our verification criteria.";
    }

    if (Object.keys(creatorPayload).length === 0 && Object.keys(profilePayload).length === 0) {
      return { success: false, error: "No changes provided." };
    }

    if (Object.keys(creatorPayload).length > 0) {
      const { error } = await admin
        .from("creator_profiles")
        .update(creatorPayload)
        .eq("user_id", parsed.data.userId);
      if (error) return { success: false, error: error.message };
    }

    if (Object.keys(profilePayload).length > 0) {
      const { error } = await admin
        .from("profiles")
        .update(profilePayload)
        .eq("id", parsed.data.userId);
      if (error) return { success: false, error: error.message };
    }

    const payload = { ...creatorPayload, ...profilePayload };

    await logAdminAction(admin, {
      actorId: ctx.userId,
      action: "admin.creator.updated",
      entityType: "creator_profiles",
      entityId: parsed.data.userId,
      afterState: payload,
    });

    // Notify creator of KYC outcome so they don't have to poll their profile
    if (parsed.data.approveVerification || parsed.data.rejectVerification) {
      const { notifyKycDecision } = await import("@/lib/notifications/emit");
      await notifyKycDecision(admin, {
        creatorId: parsed.data.userId,
        outcome: parsed.data.approveVerification ? "approved" : "rejected",
        rejectionReason: parsed.data.rejectionReason,
      }).catch(() => {});
    }

    revalidateAdmin();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Update failed.",
    };
  }
}

export async function adminModeratePost(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = adminModeratePostSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const ctx = await requireAdminStaff("moderator");
    const admin = createAdminClient();
    const adminUserId = await getAdminUserId(admin, ctx.userId);

    const moderationStatus =
      parsed.data.action === "approve"
        ? "approved"
        : parsed.data.action === "reject"
          ? "rejected"
          : "rejected";

    const postUpdate: Record<string, unknown> = {
      moderation_status: moderationStatus,
    };

    if (parsed.data.action === "remove") {
      postUpdate.status = "removed";
      postUpdate.removed_at = new Date().toISOString();
    }

    const { error: postError } = await admin
      .from("posts")
      .update(postUpdate)
      .eq("id", parsed.data.postId);

    if (postError) return { success: false, error: postError.message };

    await admin
      .from("moderation_queue")
      .update({ status: moderationStatus })
      .eq("entity_type", "post")
      .eq("entity_id", parsed.data.postId);

    if (adminUserId) {
      await admin.from("moderation_actions").insert({
        moderator_id: adminUserId,
        action:
          parsed.data.action === "approve"
            ? "approve"
            : parsed.data.action === "remove"
              ? "remove"
              : "reject",
        entity_type: "post",
        entity_id: parsed.data.postId,
        reason: parsed.data.reason ?? null,
      });
    }

    await logAdminAction(admin, {
      actorId: ctx.userId,
      action: "admin.post.moderated",
      entityType: "posts",
      entityId: parsed.data.postId,
      afterState: { action: parsed.data.action, moderation_status: moderationStatus },
    });

    revalidateAdmin();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Moderation failed.",
    };
  }
}

export async function adminResolveReport(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = adminResolveReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const ctx = await requireAdminStaff("moderator");
    const admin = createAdminClient();
    const adminUserId = await getAdminUserId(admin, ctx.userId);

    const { error } = await admin
      .from("reports")
      .update({
        status: parsed.data.status,
        resolution_notes: parsed.data.notes ?? null,
        resolved_by: adminUserId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.reportId);

    if (error) return { success: false, error: error.message };

    await logAdminAction(admin, {
      actorId: ctx.userId,
      action: "admin.report.resolved",
      entityType: "reports",
      entityId: parsed.data.reportId,
      afterState: { status: parsed.data.status },
    });

    revalidateAdmin();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Resolve failed.",
    };
  }
}

export async function adminReviewPayout(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = adminPayoutReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const ctx = await requireAdminStaff("admin");
    assertStaffRole(ctx, "admin");
    const admin = createAdminClient();
    const adminUserId = await getAdminUserId(admin, ctx.userId);

    if (!adminUserId) {
      return {
        success: false,
        error: "Your account is not linked to an admin_users record.",
      };
    }

    if (parsed.data.action === "approve") {
      const { error } = await admin.rpc("admin_approve_payout_request", {
        p_request_id: parsed.data.requestId,
        p_admin_user_id: adminUserId,
      });
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await admin.rpc("admin_reject_payout_request", {
        p_request_id: parsed.data.requestId,
        p_admin_user_id: adminUserId,
        p_reason: parsed.data.reason ?? "Rejected by admin",
      });
      if (error) return { success: false, error: error.message };
    }

    await logAdminAction(admin, {
      actorId: ctx.userId,
      action: "admin.payout.reviewed",
      entityType: "payout_requests",
      entityId: parsed.data.requestId,
      afterState: { action: parsed.data.action },
    });

    revalidateAdmin();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Payout review failed.",
    };
  }
}

export async function adminResolveDispute(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = adminResolveDisputeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const ctx = await requireAdminStaff("admin");
    assertStaffRole(ctx, "admin");
    const admin = createAdminClient();
    const adminUserId = await getAdminUserId(admin, ctx.userId);

    if (!adminUserId) {
      return {
        success: false,
        error: "Your account is not linked to an admin_users record.",
      };
    }

    const { data: dispute, error: fetchError } = await admin
      .from("disputes")
      .select("id, payment_id, creator_id, fan_id, status, amount_kobo")
      .eq("id", parsed.data.disputeId)
      .maybeSingle();

    if (fetchError || !dispute) {
      return { success: false, error: "Dispute not found." };
    }

    if (dispute.status !== "open") {
      return { success: false, error: "This dispute has already been resolved." };
    }

    const { data: payment } = await admin
      .from("payments")
      .select("subscription_id")
      .eq("id", dispute.payment_id)
      .maybeSingle();

    await resolveDispute(admin, {
      disputeId: dispute.id,
      paymentId: dispute.payment_id,
      creatorId: dispute.creator_id,
      fanId: dispute.fan_id,
      subscriptionId: payment?.subscription_id ?? null,
      amountKobo: dispute.amount_kobo,
      outcome: parsed.data.outcome,
      notes: parsed.data.notes ?? null,
      resolvedBy: adminUserId,
      source: "admin",
    });

    await logAdminAction(admin, {
      actorId: ctx.userId,
      action: "admin.dispute.resolved",
      entityType: "disputes",
      entityId: dispute.id,
      afterState: { outcome: parsed.data.outcome },
    });

    revalidateAdmin();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Dispute resolution failed.",
    };
  }
}

export async function adminResolveAppeal(
  input: unknown,
): Promise<AdminActionResult> {
  const parsed = adminResolveAppealSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input." };
  }

  try {
    const ctx = await requireAdminStaff("admin");
    assertStaffRole(ctx, "admin");
    const admin = createAdminClient();

    const { data: appeal, error: fetchError } = await admin
      .from("account_appeals")
      .select("id, user_id, status")
      .eq("id", parsed.data.appealId)
      .maybeSingle();

    if (fetchError || !appeal) {
      return { success: false, error: "Appeal not found." };
    }

    if (appeal.status !== "pending") {
      return { success: false, error: "This appeal has already been resolved." };
    }

    const { error: updateError } = await admin
      .from("account_appeals")
      .update({
        status: parsed.data.outcome,
        admin_notes: parsed.data.notes ?? null,
        resolved_by: ctx.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", appeal.id);

    if (updateError) return { success: false, error: updateError.message };

    if (parsed.data.outcome === "approved") {
      const { error: reinstateError } = await admin
        .from("profiles")
        .update({ status: "active" })
        .eq("id", appeal.user_id);

      if (reinstateError) {
        return { success: false, error: reinstateError.message };
      }
    }

    await logAdminAction(admin, {
      actorId: ctx.userId,
      action: "admin.appeal.resolved",
      entityType: "account_appeals",
      entityId: appeal.id,
      afterState: { outcome: parsed.data.outcome },
    });

    void notifyAppealResolved(admin, {
      userId: appeal.user_id,
      appealId: appeal.id,
      outcome: parsed.data.outcome,
      notes: parsed.data.notes ?? null,
    }).catch((err) => console.error("[notify:appeal_update]", err));

    revalidateAdmin();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Appeal resolution failed.",
    };
  }
}
