import { paystackRequest } from "@/lib/paystack/client";

type TransferResponse = {
  transfer_code: string;
  reference: string;
  status: string;
};

export async function initiatePaystackTransfer(input: {
  recipientCode: string;
  amountKobo: number;
  reference: string;
  reason?: string;
}): Promise<{ transferCode: string; reference: string }> {
  const data = await paystackRequest<TransferResponse>("/transfer", {
    method: "POST",
    body: {
      source: "balance",
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reason: input.reason ?? "Fanbase NG creator payout",
      reference: input.reference,
    },
  });

  return {
    transferCode: data.transfer_code,
    reference: data.reference,
  };
}
