import type { NotificationType } from "@/types/notifications";

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  new_subscriber: "New subscribers",
  new_message: "New messages",
  new_comment: "Comments on your posts",
  new_like: "Likes on your posts",
  new_payout: "Payout updates",
  creator_live: "Creator going live",
  new_tip: "Tips received",
  new_post: "New posts from creators you follow",
  payment_dispute: "Payment dispute alerts",
  account_status: "Account status changes",
  appeal_update: "Appeal updates",
  payment_failed: "Renewal payment problems",
  subscription_ended: "Subscription ended",
  resubscribe_reminder: "Resubscribe reminders",
  account_deletion: "Account deletion updates",
  gift_subscription: "Gift subscriptions",
  missed_call: "Missed calls",
  copyright_claim: "Copyright / DMCA takedown notices",
};

export const NOTIFICATION_TYPES: NotificationType[] = [
  "new_subscriber",
  "new_message",
  "new_comment",
  "new_like",
  "new_payout",
  "creator_live",
  "new_tip",
  "new_post",
  "payment_dispute",
  "account_status",
  "appeal_update",
  "payment_failed",
  "subscription_ended",
  "resubscribe_reminder",
  "account_deletion",
  "gift_subscription",
  "missed_call",
  "copyright_claim",
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
  new_post: true,
  payment_dispute: true,
  account_status: true,
  appeal_update: true,
  payment_failed: true,
  subscription_ended: true,
  resubscribe_reminder: true,
  account_deletion: true,
  gift_subscription: true,
  missed_call: true,
  copyright_claim: true,
};

export const NOTIFICATIONS_PAGE_SIZE = 25;
