import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  EarningsDailyRow,
  PayoutAccountRow,
  PayoutRequestRow,
  WalletSummary,
  WalletTransactionRow,
} from "@/types/wallet";

export async function getCreatorWallet(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<WalletSummary | null> {
  const { data, error } = await supabase
    .from("wallets")
    .select(
      "id, owner_id, available_kobo, pending_kobo, lifetime_credited_kobo, lifetime_debited_kobo, currency",
    )
    .eq("owner_id", creatorId)
    .eq("owner_type", "creator")
    .maybeSingle();

  if (error || !data) return null;
  return data as WalletSummary;
}

export async function listWalletTransactions(
  supabase: SupabaseClient,
  walletId: string,
  limit = 50,
): Promise<WalletTransactionRow[]> {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select(
      "id, wallet_id, payment_id, amount_kobo, balance_available_after_kobo, balance_pending_after_kobo, type, description, metadata, clears_at, created_at",
    )
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as WalletTransactionRow[];
}

export async function listEarningsDaily(
  supabase: SupabaseClient,
  creatorId: string,
  days = 30,
): Promise<EarningsDailyRow[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("earnings_daily")
    .select(
      "date, gross_kobo, platform_fee_kobo, payment_fee_kobo, net_kobo, subscription_kobo, ppv_kobo, tips_kobo, message_ppv_kobo",
    )
    .eq("creator_id", creatorId)
    .gte("date", sinceIso)
    .order("date", { ascending: false });

  if (error || !data) return [];
  return data as EarningsDailyRow[];
}

export async function getEarningsTotals(
  supabase: SupabaseClient,
  creatorId: string,
  days = 30,
): Promise<{
  gross_kobo: number;
  net_kobo: number;
  platform_fee_kobo: number;
  payment_fee_kobo: number;
}> {
  const rows = await listEarningsDaily(supabase, creatorId, days);
  return rows.reduce(
    (acc, row) => ({
      gross_kobo: acc.gross_kobo + row.gross_kobo,
      net_kobo: acc.net_kobo + row.net_kobo,
      platform_fee_kobo: acc.platform_fee_kobo + row.platform_fee_kobo,
      payment_fee_kobo: acc.payment_fee_kobo + row.payment_fee_kobo,
    }),
    {
      gross_kobo: 0,
      net_kobo: 0,
      platform_fee_kobo: 0,
      payment_fee_kobo: 0,
    },
  );
}

export async function listPayoutAccounts(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<PayoutAccountRow[]> {
  const { data, error } = await supabase
    .from("payout_accounts")
    .select(
      "id, creator_id, type, bank_code, bank_name, account_number_last4, account_name, is_verified, is_default, created_at",
    )
    .eq("creator_id", creatorId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as PayoutAccountRow[];
}

export async function listPayoutRequests(
  supabase: SupabaseClient,
  creatorId: string,
  limit = 20,
): Promise<PayoutRequestRow[]> {
  const { data, error } = await supabase
    .from("payout_requests")
    .select(
      `
      id,
      amount_kobo,
      fee_kobo,
      net_amount_kobo,
      status,
      failure_reason,
      created_at,
      processed_at,
      payout_accounts (
        bank_name,
        account_number_last4,
        account_name
      )
    `,
    )
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row) => {
    const accountRaw = row.payout_accounts as
      | {
          bank_name: string | null;
          account_number_last4: string;
          account_name: string;
        }
      | {
          bank_name: string | null;
          account_number_last4: string;
          account_name: string;
        }[]
      | null;
    const account = Array.isArray(accountRaw) ? accountRaw[0] : accountRaw;

    return {
      id: row.id,
      amount_kobo: row.amount_kobo,
      fee_kobo: row.fee_kobo,
      net_amount_kobo: row.net_amount_kobo,
      status: row.status,
      failure_reason: row.failure_reason,
      created_at: row.created_at,
      processed_at: row.processed_at,
      payout_account: account
        ? {
            bank_name: account.bank_name,
            account_number_last4: account.account_number_last4,
            account_name: account.account_name,
          }
        : undefined,
    };
  });
}

export type CreatorWalletOverview = {
  wallet: WalletSummary | null;
  earnings30d: Awaited<ReturnType<typeof getEarningsTotals>>;
  recentTransactions: WalletTransactionRow[];
};

export async function getCreatorWalletOverview(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<CreatorWalletOverview> {
  const wallet = await getCreatorWallet(supabase, creatorId);
  const earnings30d = await getEarningsTotals(supabase, creatorId, 30);
  const recentTransactions = wallet
    ? await listWalletTransactions(supabase, wallet.id, 8)
    : [];

  return { wallet, earnings30d, recentTransactions };
}
