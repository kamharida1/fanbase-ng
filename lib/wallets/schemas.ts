import { z } from "zod";

import { MIN_WITHDRAWAL_KOBO } from "@/lib/wallets/constants";

export const nigerianAccountNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Account number must be 10 digits");

export const addPayoutAccountSchema = z.object({
  bank_code: z.string().trim().min(2).max(10),
  bank_name: z.string().trim().min(2).max(120),
  account_number: nigerianAccountNumberSchema,
  account_name: z
    .string()
    .trim()
    .min(2, "Account name is required")
    .max(120),
  set_default: z.boolean().default(true),
});

export const requestWithdrawalSchema = z.object({
  payout_account_id: z.string().uuid("Select a payout account"),
  amount_ngn: z
    .number()
    .positive("Enter an amount greater than zero")
    .max(50_000_000, "Amount is too large"),
});

export function validateWithdrawalAmountKobo(amountKobo: number): string | null {
  if (amountKobo < MIN_WITHDRAWAL_KOBO) {
    return `Minimum withdrawal is ₦${MIN_WITHDRAWAL_KOBO / 100}.`;
  }
  return null;
}

export function ngnToKobo(ngn: number): number {
  return Math.round(ngn * 100);
}
