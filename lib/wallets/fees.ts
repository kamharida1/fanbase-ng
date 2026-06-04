import {
  EARNINGS_CLEARANCE_DAYS,
  PAYMENT_FEE_BPS,
  PLATFORM_FEE_BPS,
} from "@/lib/wallets/constants";

export type EarningsBreakdown = {
  grossKobo: number;
  platformFeeKobo: number;
  paymentFeeKobo: number;
  netKobo: number;
  clearanceDays: number;
};

export function calculateEarningsBreakdown(grossKobo: number): EarningsBreakdown {
  const platformFeeKobo = Math.floor((grossKobo * PLATFORM_FEE_BPS) / 10_000);
  const paymentFeeKobo = Math.floor((grossKobo * PAYMENT_FEE_BPS) / 10_000);
  const netKobo = grossKobo - platformFeeKobo - paymentFeeKobo;

  return {
    grossKobo,
    platformFeeKobo,
    paymentFeeKobo,
    netKobo,
    clearanceDays: EARNINGS_CLEARANCE_DAYS,
  };
}
