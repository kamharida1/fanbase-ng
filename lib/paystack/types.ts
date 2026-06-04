/** Paystack webhook envelope */
export type PaystackWebhookBody = {
  event: string;
  data: Record<string, unknown>;
};

export type PaystackTransactionStatus =
  | "success"
  | "failed"
  | "abandoned"
  | "pending"
  | "reversed";

export type PaystackVerifiedTransaction = {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  status: PaystackTransactionStatus;
  paid_at?: string;
  channel?: string;
  customer?: {
    id?: number;
    customer_code?: string;
    email?: string;
  };
  authorization?: {
    authorization_code?: string;
    reusable?: boolean;
  };
  metadata?: Record<string, unknown>;
  subscription?: Record<string, unknown>;
};

export type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data: PaystackVerifiedTransaction;
};

export const PAYSTACK_SUBSCRIPTION_PURPOSE = "subscription_checkout" as const;

export type SubscriptionCheckoutMetadata = {
  fan_id: string;
  plan_id: string;
  creator_id: string;
  billing_interval: string;
  purpose: typeof PAYSTACK_SUBSCRIPTION_PURPOSE;
};
