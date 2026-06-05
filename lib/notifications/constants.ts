import type { NotificationType } from "@/types/notifications";

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  new_subscriber: "New subscribers",
  new_message: "New messages",
  new_comment: "Comments on your posts",
  new_like: "Likes on your posts",
  new_payout: "Payout updates",
  creator_live: "Creator going live",
  new_tip: "Tips received",
};

export const NOTIFICATION_TYPES: NotificationType[] = [
  "new_subscriber",
  "new_message",
  "new_comment",
  "new_like",
  "new_payout",
  "creator_live",
  "new_tip",
];

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<
  NotificationType,
  boolean
> = {
  new_subscriber: true,
  new_message: true,
  new_comment: true,
  new_like: true,
  new_payout: true,
  creator_live: true,
  new_tip: true,
};

export const NOTIFICATIONS_PAGE_SIZE = 25;
