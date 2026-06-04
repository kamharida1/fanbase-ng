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
};
