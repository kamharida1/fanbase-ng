import type {
  RealtimeChannel,
  SupabaseClient,
} from "@supabase/supabase-js";

import type { NotificationRow } from "@/types/notifications";

export function subscribeToNotifications(
  supabase: SupabaseClient,
  userId: string,
  handlers: {
    onInsert: (notification: NotificationRow) => void;
    onUpdate?: (notification: NotificationRow) => void;
  },
): RealtimeChannel {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        handlers.onInsert(payload.new as NotificationRow);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        handlers.onUpdate?.(payload.new as NotificationRow);
      },
    )
    .subscribe();
}

export function unsubscribeNotifications(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
) {
  supabase.removeChannel(channel);
}
