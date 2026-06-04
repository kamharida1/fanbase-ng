import { z } from "zod";

import { MAX_CAPTION_LENGTH, MAX_COMMENT_LENGTH } from "@/lib/posts/constants";

export const postVisibilitySchema = z.enum([
  "public",
  "subscribers",
  "tier",
  "ppv",
]);

export const postTypeSchema = z.enum(["text", "image", "video"]);

export const upsertPostSchema = z
  .object({
    postId: z.string().uuid().optional(),
    type: postTypeSchema,
    caption: z
      .string()
      .trim()
      .max(MAX_CAPTION_LENGTH)
      .optional()
      .or(z.literal("")),
    visibility: postVisibilitySchema,
    planId: z.string().uuid().optional().nullable(),
    ppvPriceNgn: z.number().positive().max(1_000_000).optional().nullable(),
    scheduledAt: z.string().datetime().optional().nullable(),
    publishNow: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.visibility === "tier" && !data.planId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a tier for tier-only posts",
        path: ["planId"],
      });
    }
    if (data.visibility === "ppv" && !data.ppvPriceNgn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PPV posts require a price",
        path: ["ppvPriceNgn"],
      });
    }
    if (data.visibility !== "tier") {
      data.planId = null;
    }
    if (data.visibility !== "ppv") {
      data.ppvPriceNgn = null;
    }
  });

export const commentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
  parentId: z.string().uuid().optional().nullable(),
});

export const likePostSchema = z.object({
  postId: z.string().uuid(),
});

export function ngnToKobo(ngn: number): number {
  return Math.round(ngn * 100);
}
