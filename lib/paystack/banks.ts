import { paystackRequest } from "@/lib/paystack/client";

export type PaystackBank = {
  name: string;
  slug: string;
  code: string;
  active: boolean;
};

type BankListResponse = PaystackBank[];

export async function listNigerianBanks(): Promise<PaystackBank[]> {
  const data = await paystackRequest<BankListResponse>(
    "/bank?country=nigeria&perPage=100",
  );
  return (data ?? []).filter((b) => b.active);
}

type ResolveAccountData = {
  account_number: string;
  account_name: string;
  bank_id: number;
};

export async function resolveBankAccount(input: {
  accountNumber: string;
  bankCode: string;
}): Promise<ResolveAccountData> {
  const params = new URLSearchParams({
    account_number: input.accountNumber,
    bank_code: input.bankCode,
  });
  return paystackRequest<ResolveAccountData>(
    `/bank/resolve?${params.toString()}`,
  );
}
