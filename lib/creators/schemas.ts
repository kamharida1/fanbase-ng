import { z } from "zod";

import { USERNAME_PATTERN } from "@/lib/auth/constants";

const optionalUrl = z
  .string()
  .trim()
  .url("Enter a valid URL including https://")
  .optional()
  .or(z.literal(""));

export const socialLinksSchema = z.object({
  website: optionalUrl,
  twitter: optionalUrl,
  instagram: optionalUrl,
  tiktok: optionalUrl,
  youtube: optionalUrl,
});

export const updateProfileBasicsSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(80, "Display name is too long"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      USERNAME_PATTERN,
      "Username: 3–30 chars, lowercase letters, numbers, underscore",
    ),
});

export const updateCreatorProfileSchema = z.object({
  bio: z
    .string()
    .trim()
    .max(2000, "Bio must be 2000 characters or less")
    .optional()
    .or(z.literal("")),
  is_accepting_subscribers: z.boolean().optional(),
  social_links: socialLinksSchema,
});

export const subscriptionPlanSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    billing_interval: z.enum(["monthly", "annual", "free"]),
    price_ngn: z
      .number()
      .min(0, "Price cannot be negative")
      .max(1_000_000, "Price is too high"),
    trial_days: z.number().int().min(0).max(90).default(0),
    sort_order: z.number().int().min(0).max(100).default(0),
    is_active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.billing_interval === "free") {
      if (data.price_ngn !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Free plans must have price 0",
          path: ["price_ngn"],
        });
      }
      if (data.trial_days > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Free plans cannot include a trial",
          path: ["trial_days"],
        });
      }
    } else if (data.price_ngn <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paid plans must have a price greater than zero",
        path: ["price_ngn"],
      });
    }
  });

export const imageUploadSchema = z.object({
  type: z.enum(["avatar", "banner"]),
  size: z.number().max(10 * 1024 * 1024, "File must be under 10MB"),
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});

export function ngnToKobo(ngn: number): number {
  return Math.round(ngn * 100);
}

export function koboToNgn(kobo: number): number {
  return kobo / 100;
}
