import type {
  RealtimeChannel,
  SupabaseClient,
} from "@supabase/supabase-js";

import type { ConversationRow, MessageRow } from "@/types/messaging";

export function subscribeToConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  handlers: {
    onInsert: (message: MessageRow) => void;
    onRead?: () => void;
  },
): RealtimeChannel {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as MessageRow;
        if (!row.is_deleted) {
          handlers.onInsert(row);
        }
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_reads",
      },
      () => {
        handlers.onRead?.();
      },
    )
    .subscribe();

  return channel;
}

export function subscribeToInbox(
  supabase: SupabaseClient,
  userId: string,
  role: "fan" | "creator",
  onChange: () => void,
): RealtimeChannel {
  const filter =
    role === "fan"
      ? `fan_id=eq.${userId}`
      : `creator_id=eq.${userId}`;

  return supabase
    .channel(`inbox:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "conversations",
        filter,
      },
      () => onChange(),
    )
    .subscribe();
}

export function unsubscribeChannel(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
) {
  supabase.removeChannel(channel);
}

export type { ConversationRow };
