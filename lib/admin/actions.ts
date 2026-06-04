"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { getAdminUserId, assertStaffRole } from "@/lib/admin/staff";
import {
  adminCreatorUpdateSchema,
  adminModeratePostSchema,
  adminPayoutReviewSchema,
  adminResolveReportSchema,
  adminUserStatusSchema,
} from "@/lib/admin/schemas";
import { requireAdminStaff } from "@/lib/admin/require";
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

    const payload: Record<string, unknown> = {};
    if (parsed.data.isVerified !== undefined) {
      payload.is_verified = parsed.data.isVerified;
    }
    if (parsed.data.isAcceptingSubscribers !== undefined) {
      payload.is_accepting_subscribers = parsed.data.isAcceptingSubscribers;
    }
    if (parsed.data.feedPriority !== undefined) {
      payload.feed_priority = parsed.data.feedPriority;
    }

    if (Object.keys(payload).length === 0) {
      return { success: false, error: "No changes provided." };
    }

    const { error } = await admin
      .from("creator_profiles")
      .update(payload)
      .eq("user_id", parsed.data.userId);

    if (error) return { success: false, error: error.message };

    await logAdminAction(admin, {
      actorId: ctx.userId,
      action: "admin.creator.updated",
      entityType: "creator_profiles",
      entityId: parsed.data.userId,
      afterState: payload,
    });

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
