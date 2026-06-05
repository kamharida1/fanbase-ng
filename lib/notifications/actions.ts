"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { NOTIFICATION_TYPES } from "@/lib/notifications/constants";
import { updatePreferencesSchema } from "@/lib/notifications/schemas";
import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/types/notifications";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

function revalidateNotificationPaths() {
  revalidatePath("/notifications");
  revalidatePath("/settings");
}

export async function markNotificationsReadAction(
  input: unknown,
): Promise<ActionResult<{ marked: number }>> {
  const ids = Array.isArray(input)
    ? input
    : typeof input === "object" &&
        input !== null &&
        "ids" in input &&
        Array.isArray((input as { ids: unknown }).ids)
      ? (input as { ids: string[] }).ids
      : null;

  const markAll =
    typeof input === "object" &&
    input !== null &&
    "markAll" in input &&
    (input as { markAll: boolean }).markAll === true;

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data, error } = await supabase.rpc("mark_notifications_read", {
    p_user_id: auth.userId,
    p_notification_ids: ids ?? null,
    p_mark_all: markAll,
  });

  if (error) return { success: false, error: error.message };

  revalidateNotificationPaths();
  return { success: true, data: { marked: (data as number) ?? 0 } };
}

export async function updateNotificationPreferencesAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = updatePreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid preferences",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: existing } = await supabase
    .from("notification_preferences")
    .select("preferences")
    .eq("user_id", auth.userId)
    .maybeSingle();

  const merged: Record<string, boolean> = {
    ...((existing?.preferences as Record<string, boolean>) ?? {}),
  };

  for (const type of NOTIFICATION_TYPES) {
    if (typeof parsed.data[type] === "boolean") {
      merged[type] = parsed.data[type]!;
    }
  }

  const { error } = await supabase
    .from("notification_preferences")
    .upsert({
      user_id: auth.userId,
      preferences: merged,
      email_enabled: parsed.data.emailEnabled ?? true,
      push_enabled: parsed.data.pushEnabled ?? true,
      sms_enabled: parsed.data.smsEnabled ?? false,
      marketing_enabled: parsed.data.marketingEnabled ?? false,
    });

  if (error) return { success: false, error: error.message };

  revalidateNotificationPaths();
  return { success: true };
}
