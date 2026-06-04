import { z } from "zod";

export const presignMediaSchema = z.object({
  context: z.enum(["post", "message", "profile"]),
  contextRefId: z.string().uuid(),
  mime: z.string().min(3).max(120),
  byteSize: z.number().int().positive().max(600 * 1024 * 1024),
  filename: z.string().min(1).max(200),
});

export const confirmMediaSchema = z.object({
  uploadId: z.string().uuid(),
  streamUid: z.string().min(8).max(64).optional(),
});

export const deliveryMediaSchema = z.object({
  uploadId: z.string().uuid().optional(),
  objectKey: z.string().min(1).max(500).optional(),
  streamUid: z.string().min(8).max(64).optional(),
});

export const virusScanWebhookSchema = z.object({
  uploadId: z.string().uuid(),
  status: z.enum(["clean", "infected", "error"]),
  provider: z.string().max(64).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
