export type WalletOwnerType = "fan" | "creator";

export type WalletSummary = {
  id: string;
  owner_id: string;
  available_kobo: number;
  pending_kobo: number;
  lifetime_credited_kobo: number;
  lifetime_debited_kobo: number;
  currency: string;
};

export type WalletTransactionRow = {
  id: string;
  wallet_id: string;
  payment_id: string | null;
  amount_kobo: number;
  balance_available_after_kobo: number;
  balance_pending_after_kobo: number;
  type: string;
  description: string | null;
  metadata: Record<string, unknown>;
  clears_at: string | null;
  created_at: string;
};

export type EarningsDailyRow = {
  date: string;
  gross_kobo: number;
  platform_fee_kobo: number;
  payment_fee_kobo: number;
  net_kobo: number;
  subscription_kobo: number;
  ppv_kobo: number;
  tips_kobo: number;
  message_ppv_kobo: number;
};

export type PayoutAccountRow = {
  id: string;
  creator_id: string;
  type: "bank_account" | "mobile_money";
  bank_code: string | null;
  bank_name: string | null;
  account_number_last4: string;
  account_name: string;
  is_verified: boolean;
  is_default: boolean;
  created_at: string;
};

export type PayoutRequestRow = {
  id: string;
  amount_kobo: number;
  fee_kobo: number;
  net_amount_kobo: number;
  status: string;
  failure_reason: string | null;
  created_at: string;
  processed_at: string | null;
  payout_account?: {
    bank_name: string | null;
    account_number_last4: string;
    account_name: string;
  };
};
