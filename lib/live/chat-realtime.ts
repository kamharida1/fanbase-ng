import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { LiveChatMessageRow } from "@/lib/live/chat";

export function subscribeToLiveChat(
  supabase: SupabaseClient,
  streamId: string,
  onInsert: (message: LiveChatMessageRow) => void,
): RealtimeChannel {
  return supabase
    .channel(`live_chat:${streamId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "live_chat_messages",
        filter: `stream_id=eq.${streamId}`,
      },
      (payload) => {
        onInsert(payload.new as LiveChatMessageRow);
      },
    )
    .subscribe();
}

export function unsubscribeChannel(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
) {
  supabase.removeChannel(channel);
}
