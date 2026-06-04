import { formatNgnFromKobo } from "@/lib/creators/format";

export { formatNgnFromKobo };

const TX_LABELS: Record<string, string> = {
  subscription_credit: "Subscription earnings",
  ppv_credit: "PPV earnings",
  tip_credit: "Tip",
  message_ppv_credit: "Message unlock",
  referral_credit: "Referral bonus",
  clearance_credit: "Cleared to available",
  payout_debit: "Withdrawal",
  platform_fee_debit: "Platform fee",
  payment_fee_debit: "Payment processing fee",
  refund_debit: "Refund reversal",
  adjustment_credit: "Adjustment",
  adjustment_debit: "Adjustment",
};

export function walletTxLabel(type: string): string {
  return TX_LABELS[type] ?? type.replace(/_/g, " ");
}

export function payoutStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}
