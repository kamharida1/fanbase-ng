import { paystackRequest } from "@/lib/paystack/client";
import type { PaystackVerifyResponse, PaystackVerifiedTransaction } from "@/lib/paystack/types";

export async function verifyPaystackTransaction(
  reference: string,
): Promise<PaystackVerifiedTransaction> {
  const encoded = encodeURIComponent(reference);
  const result = await paystackRequest<PaystackVerifyResponse["data"]>(
    `/transaction/verify/${encoded}`,
  );
  return result;
}
