import { z } from "zod";

export const planBillingIntervalSchema = z.enum([
  "monthly",
  "annual",
  "free",
]);

export const subscribeSchema = z.object({
  planId: z.string().uuid("Invalid plan"),
  offerId: z.string().uuid().optional(),
  bundleId: z.string().uuid().optional(),
});

export const bundleMonthsSchema = z.union([
  z.literal(3),
  z.literal(6),
  z.literal(12),
]);

export const createBundleSchema = z.object({
  planId: z.string().uuid("Invalid plan"),
  months: bundleMonthsSchema,
  discountPct: z.number().int().min(1).max(99),
});

export const giftMonthsSchema = z.union([
  z.literal(1),
  z.literal(3),
  z.literal(6),
  z.literal(12),
]);

export const sendGiftSchema = z.object({
  planId: z.string().uuid("Invalid plan"),
  recipientUsername: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Enter a username")
    .max(30, "Username is too long"),
  months: giftMonthsSchema,
  message: z.string().trim().max(280, "Message is too long").optional(),
});

export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription"),
  reason: z.string().trim().max(500).optional(),
});

export const pauseSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription"),
});
