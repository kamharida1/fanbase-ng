export {
  listEarningsDaily,
  getEarningsTotals,
  getCreatorWallet,
  listWalletTransactions,
  getCreatorWalletOverview,
} from "@/lib/wallets/queries";
export type { CreatorWalletOverview } from "@/lib/wallets/queries";

import type { EarningsDailyRow } from "@/types/wallet";

export type EarningsBreakdown = {
  gross_kobo: number;
  net_kobo: number;
  platform_fee_kobo: number;
  payment_fee_kobo: number;
  subscription_kobo: number;
  ppv_kobo: number;
  tips_kobo: number;
  message_ppv_kobo: number;
  platform_fee_pct: number;
  payment_fee_pct: number;
};

export function computeEarningsBreakdown(
  rows: EarningsDailyRow[],
): EarningsBreakdown {
  const totals = rows.reduce(
    (acc, row) => ({
      gross_kobo: acc.gross_kobo + row.gross_kobo,
      net_kobo: acc.net_kobo + row.net_kobo,
      platform_fee_kobo: acc.platform_fee_kobo + row.platform_fee_kobo,
      payment_fee_kobo: acc.payment_fee_kobo + row.payment_fee_kobo,
      subscription_kobo: acc.subscription_kobo + (row.subscription_kobo ?? 0),
      ppv_kobo: acc.ppv_kobo + (row.ppv_kobo ?? 0),
      tips_kobo: acc.tips_kobo + (row.tips_kobo ?? 0),
      message_ppv_kobo: acc.message_ppv_kobo + (row.message_ppv_kobo ?? 0),
    }),
    {
      gross_kobo: 0,
      net_kobo: 0,
      platform_fee_kobo: 0,
      payment_fee_kobo: 0,
      subscription_kobo: 0,
      ppv_kobo: 0,
      tips_kobo: 0,
      message_ppv_kobo: 0,
    },
  );

  const gross = totals.gross_kobo || 1;
  return {
    ...totals,
    platform_fee_pct: Math.round((totals.platform_fee_kobo / gross) * 100),
    payment_fee_pct: Math.round((totals.payment_fee_kobo / gross) * 100),
  };
}
