import { z } from "zod";

import { MAX_MESSAGE_BODY_LENGTH } from "@/lib/messaging/constants";

export const startConversationSchema = z.object({
  creatorId: z.string().uuid(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z
    .string()
    .trim()
    .max(MAX_MESSAGE_BODY_LENGTH, "Message is too long")
    .optional()
    .or(z.literal("")),
  attachmentPath: z.string().max(500).optional(),
  attachmentType: z.enum(["image", "video", "audio", "file"]).optional(),
  attachmentMime: z.string().max(120).optional(),
  attachmentFilename: z.string().max(255).optional(),
  attachmentSizeBytes: z.number().int().positive().optional(),
  mediaUploadId: z.string().uuid().optional(),
}).refine(
  (data) =>
    (data.body && data.body.length > 0) ||
    Boolean(data.attachmentPath) ||
    Boolean(data.mediaUploadId),
  { message: "Enter a message or attach a file" },
);

export const conversationRequestSchema = z.object({
  conversationId: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
});

export const markReadSchema = z.object({
  conversationId: z.string().uuid(),
});
