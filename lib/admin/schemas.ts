import { z } from "zod";

export const adminUserStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "suspended", "banned"]),
});

export const adminCreatorUpdateSchema = z.object({
  userId: z.string().uuid(),
  isVerified: z.boolean().optional(),
  isAcceptingSubscribers: z.boolean().optional(),
  feedPriority: z.number().int().min(0).max(100).optional(),
  approveVerification: z.boolean().optional(),
  rejectVerification: z.boolean().optional(),
  rejectionReason: z.string().max(300).optional(),
});

export const adminModeratePostSchema = z.object({
  postId: z.string().uuid(),
  action: z.enum(["approve", "reject", "remove"]),
  reason: z.string().max(500).optional(),
});

export const adminResolveReportSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["resolved", "dismissed"]),
  notes: z.string().max(2000).optional(),
});

export const adminPayoutReviewSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

export const adminResolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  outcome: z.enum(["won", "lost", "closed"]),
  notes: z.string().max(1000).optional(),
});

export const adminResolveAppealSchema = z.object({
  appealId: z.string().uuid(),
  outcome: z.enum(["approved", "denied"]),
  notes: z.string().max(1000).optional(),
});

export const adminListQuerySchema = z.object({
  q: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
