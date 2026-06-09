import { paystackRequest } from "@/lib/paystack/client";
import type { PlanBillingInterval } from "@/types/subscription";

type PaystackPlan = {
  plan_code: string;
  name: string;
  amount: number;
  interval: string;
};

function paystackInterval(interval: PlanBillingInterval): string | null {
  if (interval === "monthly") return "monthly";
  if (interval === "annual") return "annually";
  return null;
}

export async function createPaystackPlan(input: {
  name: string;
  priceKobo: number;
  billingInterval: PlanBillingInterval;
}): Promise<string> {
  const interval = paystackInterval(input.billingInterval);
  if (!interval) {
    throw new Error("Free plans cannot be synced to Paystack.");
  }

  const data = await paystackRequest<PaystackPlan>("/plan", {
    method: "POST",
    body: {
      name: input.name.slice(0, 80),
      amount: input.priceKobo,
      interval,
      currency: "NGN",
    },
  });

  return data.plan_code;
}

export async function disablePaystackSubscription(
  subscriptionCode: string,
  token?: string,
): Promise<void> {
  await paystackRequest("/subscription/disable", {
    method: "POST",
    body: {
      code: subscriptionCode,
      ...(token ? { token } : {}),
    },
  });
}

type TransferRecipient = { recipient_code: string };

export async function createTransferRecipient(input: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<string> {
  const data = await paystackRequest<TransferRecipient>("/transferrecipient", {
    method: "POST",
    body: {
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
    },
  });
  return data.recipient_code;
}
