export type AdminDashboardStats = {
  users_total: number;
  users_active: number;
  creators_total: number;
  subscriptions_active: number;
  posts_pending_moderation: number;
  reports_open: number;
  payouts_pending: number;
  payments_30d_kobo: number;
  payouts_completed_30d_kobo: number;
};

export type AdminUserRow = {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
  status: string;
  email?: string | null;
  created_at: string;
  last_seen_at: string | null;
};

export type AdminCreatorRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  is_verified: boolean;
  is_accepting_subscribers: boolean;
  feed_priority: number;
  approved_at: string | null;
  created_at: string;
  subscriber_count?: number;
  kyc_status: "none" | "pending" | "verified" | "rejected";
  verification_note: string | null;
  verification_rejected_reason: string | null;
};

export type AdminModerationItem = {
  queue_id: string;
  entity_type: string;
  entity_id: string;
  post_id: string | null;
  priority_score: number;
  status: string;
  created_at: string;
  caption: string | null;
  creator_username: string | null;
  visibility: string | null;
};

export type AdminReportRow = {
  id: string;
  reason: string;
  status: string;
  details: string | null;
  created_at: string;
  reporter_username: string | null;
  reported_username: string | null;
  post_id: string | null;
};

export type AdminPayoutRow = {
  id: string;
  creator_id: string;
  creator_username: string | null;
  amount_kobo: number;
  fee_kobo: number;
  net_amount_kobo: number;
  status: string;
  failure_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  wallet_held_kobo: number;
  wallet_debt_kobo: number;
  open_disputes_count: number;
};

export type AdminDisputeRow = {
  id: string;
  payment_id: string;
  creator_id: string | null;
  creator_username: string | null;
  fan_id: string | null;
  fan_username: string | null;
  status: string;
  amount_kobo: number;
  reason: string | null;
  evidence_due_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  needs_manual_review: boolean;
};

export type AdminAppealRow = {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  status: "pending" | "approved" | "denied";
  account_status_at_submission: string;
  current_account_status: string | null;
  message: string;
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type AdminAuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_type: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

export type AdminFinanceSummary = {
  payments_success_kobo: number;
  payments_count: number;
  payouts_completed_kobo: number;
  payouts_pending_kobo: number;
  platform_net_30d_kobo: number;
  active_subscriptions: number;
  total_debt_kobo: number;
  creators_with_debt_count: number;
};

export type AdminCreatorDebtRow = {
  creator_id: string;
  creator_username: string | null;
  debt_kobo: number;
  available_kobo: number;
  pending_kobo: number;
  held_kobo: number;
};

export type AdminWalletDetail = {
  creator_id: string;
  creator_username: string | null;
  display_name: string | null;
  available_kobo: number;
  pending_kobo: number;
  held_kobo: number;
  debt_kobo: number;
  lifetime_credited_kobo: number;
  lifetime_debited_kobo: number;
};
