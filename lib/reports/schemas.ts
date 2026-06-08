import { z } from "zod";

export const REPORT_REASONS = [
  "spam",
  "harassment",
  "underage",
  "illegal",
  "copyright",
  "impersonation",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or scam",
  harassment: "Harassment or abuse",
  underage: "Involves a minor",
  illegal: "Illegal content",
  copyright: "Copyright infringement",
  impersonation: "Impersonation",
  other: "Something else",
};

export const submitReportSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
    postId: z.string().uuid().optional(),
    reportedUserId: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.postId || value.reportedUserId), {
    message: "A report must reference a post or an account.",
  });

export type SubmitReportInput = z.infer<typeof submitReportSchema>;
