import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveMessageAttachmentUrl } from "@/lib/media/resolve-url";
import type {
  ConversationRow,
  MessageRow,
  ParticipantSnippet,
} from "@/types/messaging";

async function loadProfiles(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, ParticipantSnippet>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", unique);

  return new Map(
    (data ?? []).map((p) => [
      p.id,
      {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      },
    ]),
  );
}

function mapConversationRow(
  row: {
    id: string;
    creator_id: string;
    fan_id: string;
    status: ConversationRow["status"];
    last_message_at: string | null;
    last_message_preview: string | null;
    last_message_sender_id: string | null;
    creator_unread_count: number;
    fan_unread_count: number;
    is_blocked_by_creator: boolean;
    is_blocked_by_fan: boolean;
    created_at: string;
  },
  role: "fan" | "creator",
  profiles: Map<string, ParticipantSnippet>,
): ConversationRow {
  const otherId = role === "fan" ? row.creator_id : row.fan_id;
  return {
    ...row,
    other_participant: profiles.get(otherId),
    unread_count:
      role === "fan" ? row.fan_unread_count : row.creator_unread_count,
  };
}

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
  role: "fan" | "creator",
  filter: "inbox" | "requests" = "inbox",
): Promise<ConversationRow[]> {
  let query = supabase
    .from("conversations")
    .select(
      "id, creator_id, fan_id, status, last_message_at, last_message_preview, last_message_sender_id, creator_unread_count, fan_unread_count, is_blocked_by_creator, is_blocked_by_fan, created_at",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (role === "fan") {
    query = query.eq("fan_id", userId);
    if (filter === "requests") {
      query = query.eq("status", "pending");
    } else {
      query = query.in("status", ["accepted", "pending"]);
    }
  } else {
    query = query.eq("creator_id", userId);
    if (filter === "requests") {
      query = query.eq("status", "pending");
    } else {
      query = query.eq("status", "accepted");
    }
  }

  const { data, error } = await query;

  if (error || !data) return [];

  const profileIds = data.flatMap((r) => [r.fan_id, r.creator_id]);
  const profiles = await loadProfiles(supabase, profileIds);

  return data.map((row) => mapConversationRow(row, role, profiles));
}

export async function getConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, creator_id, fan_id, status, last_message_at, last_message_preview, last_message_sender_id, creator_unread_count, fan_unread_count, is_blocked_by_creator, is_blocked_by_fan, created_at",
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.fan_id !== userId && data.creator_id !== userId) return null;

  const role = data.fan_id === userId ? "fan" : "creator";
  const profiles = await loadProfiles(supabase, [data.fan_id, data.creator_id]);

  return mapConversationRow(data, role, profiles);
}

export async function listMessages(
  supabase: SupabaseClient,
  input: {
    conversationId: string;
    userId: string;
    otherUserId: string;
    limit?: number;
  },
): Promise<MessageRow[]> {
  const limit = input.limit ?? 80;

  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender_id, body, media_r2_key, media_upload_id, attachment_type, attachment_mime, attachment_filename, attachment_size_bytes, is_ppv, ppv_price_kobo, created_at",
    )
    .eq("conversation_id", input.conversationId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  const { data: reads } = await supabase
    .from("message_reads")
    .select("message_id, message_created_at")
    .eq("user_id", input.otherUserId)
    .in(
      "message_id",
      data.map((m) => m.id),
    );

  const readSet = new Set(
    (reads ?? []).map((r) => `${r.message_id}:${r.message_created_at}`),
  );

  const ppvMessageIds = data.filter((m) => m.is_ppv).map((m) => m.id);
  const purchasedSet = new Set<string>();
  if (ppvMessageIds.length > 0) {
    const { data: purchases } = await supabase
      .from("message_purchases")
      .select("message_id, message_created_at")
      .eq("fan_id", input.userId)
      .in("message_id", ppvMessageIds);
    (purchases ?? []).forEach((p) =>
      purchasedSet.add(`${p.message_id}:${p.message_created_at}`),
    );
  }

  const rows: MessageRow[] = [];

  for (const m of data) {
    const unlocked =
      !m.is_ppv ||
      m.sender_id === input.userId ||
      purchasedSet.has(`${m.id}:${m.created_at}`);

    let attachmentUrl: string | null = null;
    if (unlocked && (m.media_r2_key || m.media_upload_id)) {
      attachmentUrl = await resolveMessageAttachmentUrl(supabase, {
        viewerId: input.userId,
        mediaUploadId: m.media_upload_id,
        storagePath: m.media_r2_key,
      });
    }

    rows.push({
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      body: unlocked ? m.body : null,
      media_r2_key: unlocked ? m.media_r2_key : null,
      attachment_type: m.attachment_type,
      attachment_mime: m.attachment_mime,
      attachment_filename: m.attachment_filename,
      attachment_size_bytes: m.attachment_size_bytes,
      is_ppv: m.is_ppv,
      ppv_price_kobo: m.ppv_price_kobo,
      created_at: m.created_at,
      read_by_other:
        m.sender_id === input.userId &&
        readSet.has(`${m.id}:${m.created_at}`),
      attachment_url: attachmentUrl,
      unlocked,
    });
  }

  return rows;
}

export async function countPendingRequests(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<number> {
  const { count } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "pending");

  return count ?? 0;
}
