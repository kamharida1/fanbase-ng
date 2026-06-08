import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATIONS_PAGE_SIZE,
} from "@/lib/notifications/constants";
import type {
  NotificationPreferences,
  NotificationRow,
  NotificationType,
} from "@/types/notifications";

export async function getUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_notification_count", {
    p_user_id: userId,
  });

  if (error) return 0;
  return (data as number) ?? 0;
}

export async function listNotifications(
  supabase: SupabaseClient,
  input: {
    userId: string;
    limit?: number;
    cursor?: string | null;
  },
): Promise<{ notifications: NotificationRow[]; nextCursor: string | null }> {
  const limit = input.limit ?? NOTIFICATIONS_PAGE_SIZE;

  let query = supabase
    .from("notifications")
    .select(
      "id, user_id, type, title, body, channel, status, action_url, entity_type, entity_id, metadata, read_at, sent_at, created_at",
    )
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (input.cursor) {
    query = query.lt("created_at", input.cursor);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { notifications: [], nextCursor: null };
  }

  const rows = data as NotificationRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;

  return { notifications: page, nextCursor };
}

export async function getNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<NotificationPreferences> {
  const { data } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const prefs = (data?.preferences ?? {}) as Record<string, unknown>;

  const typed = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES) as NotificationType[]) {
    if (typeof prefs[key] === "boolean") {
      typed[key] = prefs[key] as boolean;
    }
  }

  return {
    user_id: userId,
    email_enabled: data?.email_enabled ?? true,
    push_enabled: data?.push_enabled ?? true,
    sms_enabled: data?.sms_enabled ?? false,
    marketing_enabled: data?.marketing_enabled ?? false,
    digest_enabled: data?.digest_enabled ?? true,
    preferences: typed,
    updated_at: data?.updated_at ?? new Date().toISOString(),
  };
}
