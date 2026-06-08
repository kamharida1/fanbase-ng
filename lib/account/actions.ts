"use server";

import { revalidatePath } from "next/cache";

import { accountDeletionScheduledFor } from "@/lib/account/constants";
import { writeAuditLog } from "@/lib/audit/log";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { notifyAccountDeletion } from "@/lib/notifications/emit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AccountDeletionActionResult =
  | { success: true; scheduledFor: string }
  | { success: false; error: string };

export type CancelAccountDeletionResult =
  | { success: true }
  | { success: false; error: string };

export async function requestAccountDeletion(): Promise<AccountDeletionActionResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  const admin = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("deletion_scheduled_for")
    .eq("id", auth.userId)
    .maybeSingle();

  if (profile?.deletion_scheduled_for) {
    return { success: false, error: "Account deletion is already scheduled." };
  }

  if (auth.profile.role === "creator") {
    const [{ data: wallet }, { data: openDisputes }] = await Promise.all([
      admin
        .from("wallets")
        .select("debt_kobo")
        .eq("owner_id", auth.userId)
        .eq("owner_type", "creator")
        .maybeSingle(),
      admin
        .from("disputes")
        .select("id")
        .eq("creator_id", auth.userId)
        .eq("status", "open")
        .limit(1),
    ]);

    if (wallet && wallet.debt_kobo > 0) {
      return {
        success: false,
        error: "You have an outstanding balance owed to the platform. Settle it before deleting your account.",
      };
    }
    if (openDisputes && openDisputes.length > 0) {
      return {
        success: false,
        error: "You have an open payment dispute. It must be resolved before you can delete your account.",
      };
    }
  }

  const requestedAt = new Date();
  const scheduledFor = accountDeletionScheduledFor(requestedAt);

  const { error } = await admin
    .from("profiles")
    .update({
      deletion_requested_at: requestedAt.toISOString(),
      deletion_scheduled_for: scheduledFor.toISOString(),
    })
    .eq("id", auth.userId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog(admin, {
    actorId: auth.userId,
    actorType: "user",
    action: "account.deletion_requested",
    entityType: "profiles",
    entityId: auth.userId,
    afterState: { deletion_scheduled_for: scheduledFor.toISOString() },
  });

  await notifyAccountDeletion(admin, {
    userId: auth.userId,
    stage: "scheduled",
    scheduledFor,
  });

  revalidatePath("/settings");
  return { success: true, scheduledFor: scheduledFor.toISOString() };
}

export async function cancelAccountDeletion(): Promise<CancelAccountDeletionResult> {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  const admin = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("deletion_scheduled_for")
    .eq("id", auth.userId)
    .maybeSingle();

  if (!profile?.deletion_scheduled_for) {
    return { success: false, error: "You don't have a pending deletion request." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ deletion_requested_at: null, deletion_scheduled_for: null })
    .eq("id", auth.userId);

  if (error) return { success: false, error: error.message };

  await writeAuditLog(admin, {
    actorId: auth.userId,
    actorType: "user",
    action: "account.deletion_cancelled",
    entityType: "profiles",
    entityId: auth.userId,
  });

  await notifyAccountDeletion(admin, { userId: auth.userId, stage: "cancelled" });

  revalidatePath("/settings");
  return { success: true };
}
