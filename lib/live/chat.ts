"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export type LiveChatMessageRow = {
  id: string;
  stream_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type LiveChatResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

const MAX_BODY_LENGTH = 500;

export async function sendLiveChatMessage(input: {
  streamId: string;
  body: string;
}): Promise<LiveChatResult<{ id: string }>> {
  const body = input.body.trim();
  if (!body) return { success: false, error: "Message can't be empty." };
  if (body.length > MAX_BODY_LENGTH) {
    return { success: false, error: "Message is too long." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data, error } = await supabase
    .from("live_chat_messages")
    .insert({ stream_id: input.streamId, sender_id: auth.userId, body })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: "Could not send message." };
  }

  return { success: true, data: { id: data.id } };
}

export async function listLiveChatMessages(
  supabase: SupabaseClient,
  streamId: string,
  limit = 100,
): Promise<LiveChatMessageRow[]> {
  const { data, error } = await supabase
    .from("live_chat_messages")
    .select("id, stream_id, sender_id, body, created_at")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data?.length) return [];

  const senderIds = [...new Set(data.map((m) => m.sender_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", senderIds);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return data.map((m) => ({
    ...m,
    sender: profileById.get(m.sender_id)
      ? {
          username: profileById.get(m.sender_id)!.username,
          display_name: profileById.get(m.sender_id)!.display_name,
          avatar_url: profileById.get(m.sender_id)!.avatar_url,
        }
      : undefined,
  }));
}
