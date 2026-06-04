import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_REQUEST_INTRO_MESSAGES } from "@/lib/messaging/constants";
import type { ConversationStatus } from "@/types/messaging";

export async function canFanMessageCreator(
  supabase: SupabaseClient,
  fanId: string,
  creatorId: string,
): Promise<boolean> {
  if (fanId === creatorId) return false;

  const { data: creator } = await supabase
    .from("creator_profiles")
    .select("user_id")
    .eq("user_id", creatorId)
    .maybeSingle();

  return Boolean(creator);
}

export async function countFanMessagesInConversation(
  supabase: SupabaseClient,
  conversationId: string,
  fanId: string,
): Promise<number> {
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("sender_id", fanId)
    .eq("is_deleted", false);

  return count ?? 0;
}

export async function canSendMessageInConversation(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    senderId: string;
    fanId: string;
    creatorId: string;
    status: ConversationStatus;
    isBlocked?: boolean;
  },
): Promise<{ allowed: boolean; reason?: string }> {
  const { conversationId, senderId, fanId, creatorId, status } = input;

  if (status === "declined") {
    return { allowed: false, reason: "This conversation was declined." };
  }

  if (input.isBlocked) {
    return { allowed: false, reason: "Messaging is blocked." };
  }

  if (status === "accepted") {
    return { allowed: true };
  }

  if (status === "pending") {
    if (senderId === creatorId) {
      return { allowed: true };
    }
    if (senderId === fanId) {
      const count = await countFanMessagesInConversation(
        supabase,
        conversationId,
        fanId,
      );
      if (count >= MAX_REQUEST_INTRO_MESSAGES) {
        return {
          allowed: false,
          reason:
            "Your message request was sent. Wait for the creator to accept before sending more.",
        };
      }
      return { allowed: true };
    }
  }

  return { allowed: false, reason: "Cannot send message." };
}
