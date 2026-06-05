import { z } from "zod";

export const planBillingIntervalSchema = z.enum([
  "monthly",
  "annual",
  "free",
]);

export const subscribeSchema = z.object({
  planId: z.string().uuid("Invalid plan"),
  offerId: z.string().uuid().optional(),
});

export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid("Invalid subscription"),
  reason: z.string().trim().max(500).optional(),
});
