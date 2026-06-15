/** Max net payout auto-approved without manual review (₦200,000). */
export const PAYOUT_AUTO_APPROVE_MAX_KOBO = 20_000_000;

/** Days after first paid subscriber before first withdrawal is allowed. */
export const FIRST_WITHDRAWAL_HOLD_DAYS = 14;

/** Minimum creator account age before auto KYC approval. */
export const KYC_AUTO_MIN_ACCOUNT_DAYS = 7;

/** Minimum verification note length for auto KYC. */
export const KYC_AUTO_MIN_NOTE_LENGTH = 20;

/** Hours before we proactively notify about a delayed payout. */
export const PAYOUT_DELAY_NOTIFY_HOURS = 24;
