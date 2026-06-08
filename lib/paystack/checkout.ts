import { paystackRequest } from "@/lib/paystack/client";
import type { PlanBillingInterval } from "@/types/subscription";

type InitializeData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export function buildPaymentReference(): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `fb_sub_${suffix}`;
}

export async function initializeSubscriptionCheckout(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: {
    fan_id: string;
    plan_id: string;
    creator_id: string;
    billing_interval: PlanBillingInterval;
    purpose: "subscription_checkout";
    bundle_months?: number;
    gift_id?: string;
  };
}): Promise<InitializeData> {
  return initializePaymentCheckout(input);
}

export async function initializePaymentCheckout(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<InitializeData> {
  return paystackRequest<InitializeData>("/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      channels: ["card", "bank", "ussd", "bank_transfer"],
    },
  });
}

type CreateSubscriptionData = {
  subscription_code: string;
  email_token: string;
};

export async function createPaystackSubscription(input: {
  customerEmail: string;
  planCode: string;
  authorizationCode: string;
}): Promise<CreateSubscriptionData> {
  return paystackRequest<CreateSubscriptionData>("/subscription", {
    method: "POST",
    body: {
      customer: input.customerEmail,
      plan: input.planCode,
      authorization: input.authorizationCode,
    },
  });
}
