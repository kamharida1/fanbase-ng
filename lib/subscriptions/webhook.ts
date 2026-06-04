/**
 * @deprecated Import from `@/lib/paystack/idempotency` and `@/lib/paystack/webhook-handler`.
 */
export {
  buildPaystackEventId as buildEventId,
  finalizeWebhookEvent as markWebhookProcessed,
  reserveWebhookEvent as recordWebhookEvent,
} from "@/lib/paystack/idempotency";

export { dispatchPaystackWebhook as handlePaystackEvent } from "@/lib/paystack/webhook-handler";

export { recordSubscriptionRenewal as handleSubscriptionRenewalCharge } from "@/lib/payments/processor";
