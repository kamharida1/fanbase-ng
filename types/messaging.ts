export type ConversationStatus = "pending" | "accepted" | "declined";

export type ParticipantSnippet = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type ConversationRow = {
  id: string;
  creator_id: string;
  fan_id: string;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_sender_id: string | null;
  creator_unread_count: number;
  fan_unread_count: number;
  is_blocked_by_creator: boolean;
  is_blocked_by_fan: boolean;
  created_at: string;
  other_participant?: ParticipantSnippet;
  unread_count?: number;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  media_r2_key: string | null;
  attachment_type: string | null;
  attachment_mime: string | null;
  attachment_filename: string | null;
  attachment_size_bytes: number | null;
  is_ppv: boolean;
  ppv_price_kobo: number | null;
  is_deleted?: boolean;
  created_at: string;
  read_by_other?: boolean;
  attachment_url?: string | null;
};
