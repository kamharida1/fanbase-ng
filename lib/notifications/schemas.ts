import { z } from "zod";

const notificationTypeSchema = z.enum([
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
]);

export const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  markAll: z.boolean().optional(),
});

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  marketingEnabled: z.boolean().optional(),
  digestEnabled: z.boolean().optional(),
  new_subscriber: z.boolean().optional(),
  new_message: z.boolean().optional(),
  new_comment: z.boolean().optional(),
  new_like: z.boolean().optional(),
  new_payout: z.boolean().optional(),
  creator_live: z.boolean().optional(),
  new_tip: z.boolean().optional(),
  new_post: z.boolean().optional(),
  payment_dispute: z.boolean().optional(),
  account_status: z.boolean().optional(),
  appeal_update: z.boolean().optional(),
  payment_failed: z.boolean().optional(),
  subscription_ended: z.boolean().optional(),
  resubscribe_reminder: z.boolean().optional(),
  account_deletion: z.boolean().optional(),
  gift_subscription: z.boolean().optional(),
  missed_call: z.boolean().optional(),
  copyright_claim: z.boolean().optional(),
});

export const listNotificationsSchema = z.object({
  cursor: z.string().min(10).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
