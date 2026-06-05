export type NotificationType =
  | "new_subscriber"
  | "new_message"
  | "new_comment"
  | "new_like"
  | "new_payout"
  | "creator_live"
  | "new_tip";

export type NotificationStatus = "pending" | "sent" | "failed" | "read";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  channel: string;
  status: NotificationStatus;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type NotificationPreferences = {
  user_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  marketing_enabled: boolean;
  preferences: Record<NotificationType, boolean> & Record<string, unknown>;
  updated_at: string;
};
