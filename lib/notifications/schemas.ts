import { z } from "zod";

const notificationTypeSchema = z.enum([
  "new_subscriber",
  "new_message",
  "new_comment",
  "new_like",
  "new_payout",
  "creator_live",
]);

export const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  markAll: z.boolean().optional(),
});

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  new_subscriber: z.boolean().optional(),
  new_message: z.boolean().optional(),
  new_comment: z.boolean().optional(),
  new_like: z.boolean().optional(),
  new_payout: z.boolean().optional(),
  creator_live: z.boolean().optional(),
});

export const listNotificationsSchema = z.object({
  cursor: z.string().min(10).max(40).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
