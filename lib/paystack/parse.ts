import type { SubscriptionCheckoutMetadata } from "@/lib/paystack/types";
import { PAYSTACK_SUBSCRIPTION_PURPOSE } from "@/lib/paystack/types";

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function parseMetadata(
  data: Record<string, unknown>,
): Record<string, unknown> {
  return asRecord(data.metadata) ?? {};
}

export function parseSubscriptionCheckoutMetadata(
  data: Record<string, unknown>,
): SubscriptionCheckoutMetadata | null {
  const meta = parseMetadata(data);
  const fanId = asString(meta.fan_id);
  const planId = asString(meta.plan_id);
  const creatorId = asString(meta.creator_id);
  const billingInterval = asString(meta.billing_interval);
  const purpose = asString(meta.purpose);

  if (
    !fanId ||
    !planId ||
    !creatorId ||
    !billingInterval ||
    purpose !== PAYSTACK_SUBSCRIPTION_PURPOSE
  ) {
    return null;
  }

  return {
    fan_id: fanId,
    plan_id: planId,
    creator_id: creatorId,
    billing_interval: billingInterval,
    purpose: PAYSTACK_SUBSCRIPTION_PURPOSE,
  };
}

export function parseNestedSubscriptionCode(
  data: Record<string, unknown>,
): string | undefined {
  const direct = asString(data.subscription_code);
  if (direct) return direct;

  const sub = asRecord(data.subscription);
  return asString(sub?.subscription_code);
}

/**
 * Extracts the two fields needed for deterministic subscription matching from
 * a Paystack `subscription.create` webhook payload.
 *
 * Paystack always includes `plan.plan_code` and `customer.email` in this
 * event. Both are required; if either is absent we cannot match safely.
 */
export function parseSubscriptionCreatePayload(data: Record<string, unknown>): {
  planCode: string | undefined;
  customerEmail: string | undefined;
} {
  const planObj = asRecord(data.plan);
  const customerObj = asRecord(data.customer);
  return {
    planCode: asString(planObj?.plan_code),
    customerEmail: asString(customerObj?.email),
  };
}
