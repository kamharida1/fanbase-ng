import type { SupabaseClient } from "@supabase/supabase-js";

import { postgrestIlikePattern, sanitizePostgrestIlikeTerm } from "@/lib/security/postgrest-search";
import type {
  AdminAuditRow,
  AdminCreatorRow,
  AdminDashboardStats,
  AdminFinanceSummary,
  AdminModerationItem,
  AdminPayoutRow,
  AdminReportRow,
  AdminUserRow,
} from "@/types/admin";

export async function getAdminDashboardStats(
  admin: SupabaseClient,
): Promise<AdminDashboardStats> {
  const { data, error } = await admin.rpc("admin_get_dashboard_stats");

  if (error || !data) {
    return {
      users_total: 0,
      users_active: 0,
      creators_total: 0,
      subscriptions_active: 0,
      posts_pending_moderation: 0,
      reports_open: 0,
      payouts_pending: 0,
      payments_30d_kobo: 0,
      payouts_completed_30d_kobo: 0,
    };
  }

  return data as AdminDashboardStats;
}

export async function listAdminUsers(
  admin: SupabaseClient,
  input: { q?: string; page: number; limit: number },
): Promise<{ users: AdminUserRow[]; total: number }> {
  const from = (input.page - 1) * input.limit;
  const to = from + input.limit - 1;

  let query = admin
    .from("profiles")
    .select(
      "id, username, display_name, role, status, created_at, last_seen_at",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  const searchTerm = input.q ? sanitizePostgrestIlikeTerm(input.q) : null;
  if (searchTerm) {
    const pattern = postgrestIlikePattern(searchTerm);
    query = query.or(
      `username.ilike.${pattern},display_name.ilike.${pattern}`,
    );
  }

  const { data, count, error } = await query;
  if (error || !data) return { users: [], total: 0 };

  const users: AdminUserRow[] = [];
  for (const row of data) {
    let email: string | null = null;
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(row.id);
      email = authUser?.user?.email ?? null;
    } catch {
      email = null;
    }
    users.push({ ...row, email });
  }

  return { users, total: count ?? 0 };
}

export async function listAdminCreators(
  admin: SupabaseClient,
  input: { q?: string; page: number; limit: number },
): Promise<{ creators: AdminCreatorRow[]; total: number }> {
  const from = (input.page - 1) * input.limit;
  const to = from + input.limit - 1;

  let query = admin
    .from("creator_profiles")
    .select(
      `
      user_id,
      is_verified,
      is_accepting_subscribers,
      feed_priority,
      approved_at,
      created_at,
      profiles!inner (username, display_name)
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const creatorSearch = input.q ? sanitizePostgrestIlikeTerm(input.q) : null;
  if (creatorSearch) {
    const pattern = postgrestIlikePattern(creatorSearch);
    query = query.or(
      `profiles.username.ilike.${pattern},profiles.display_name.ilike.${pattern}`,
    );
  }

  const { data, count, error } = await query;
  if (error || !data) return { creators: [], total: 0 };

  const creators: AdminCreatorRow[] = data.map((row) => {
    const rawProfile = row.profiles as
      | { username: string; display_name: string | null }
      | { username: string; display_name: string | null }[];
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    return {
      user_id: row.user_id,
      username: profile.username,
      display_name: profile.display_name,
      is_verified: row.is_verified,
      is_accepting_subscribers: row.is_accepting_subscribers,
      feed_priority: row.feed_priority ?? 0,
      approved_at: row.approved_at,
      created_at: row.created_at,
    };
  });

  return { creators, total: count ?? 0 };
}

export async function listModerationQueue(
  admin: SupabaseClient,
  limit = 50,
): Promise<AdminModerationItem[]> {
  const { data: queue } = await admin
    .from("moderation_queue")
    .select(
      "id, entity_type, entity_id, post_id, priority_score, status, created_at",
    )
    .eq("status", "pending")
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!queue?.length) return [];

  const postIds = queue
    .map((q) => q.post_id)
    .filter((id): id is string => Boolean(id));

  const { data: posts } = await admin
    .from("posts")
    .select("id, caption, visibility, creator_id")
    .in("id", postIds);

  const creatorIds = [...new Set((posts ?? []).map((p) => p.creator_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username")
    .in("id", creatorIds);

  const postMap = new Map((posts ?? []).map((p) => [p.id, p]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  return queue.map((q) => {
    const post = q.post_id ? postMap.get(q.post_id) : null;
    return {
      queue_id: q.id,
      entity_type: q.entity_type,
      entity_id: q.entity_id,
      post_id: q.post_id,
      priority_score: q.priority_score,
      status: q.status,
      created_at: q.created_at,
      caption: post?.caption ?? null,
      creator_username: post ? profileMap.get(post.creator_id) ?? null : null,
      visibility: post?.visibility ?? null,
    };
  });
}

export async function listAdminReports(
  admin: SupabaseClient,
  input: { status?: string; limit?: number },
): Promise<AdminReportRow[]> {
  let query = admin
    .from("reports")
    .select(
      "id, reason, status, details, created_at, reporter_id, reported_user_id, post_id",
    )
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (input.status) {
    query = query.eq("status", input.status);
  } else {
    query = query.in("status", ["open", "reviewing"]);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const userIds = [
    ...new Set(
      data.flatMap((r) => [r.reporter_id, r.reported_user_id].filter(Boolean)),
    ),
  ] as string[];

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  return data.map((r) => ({
    id: r.id,
    reason: r.reason,
    status: r.status,
    details: r.details,
    created_at: r.created_at,
    reporter_username: profileMap.get(r.reporter_id) ?? null,
    reported_username: r.reported_user_id
      ? profileMap.get(r.reported_user_id) ?? null
      : null,
    post_id: r.post_id,
  }));
}

export async function listAdminPayouts(
  admin: SupabaseClient,
  input: { status?: string[]; limit?: number },
): Promise<AdminPayoutRow[]> {
  let query = admin
    .from("payout_requests")
    .select(
      "id, creator_id, amount_kobo, fee_kobo, net_amount_kobo, status, failure_reason, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (input.status?.length) {
    query = query.in("status", input.status);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const creatorIds = [...new Set(data.map((p) => p.creator_id))];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username")
    .in("id", creatorIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  return data.map((p) => ({
    ...p,
    creator_username: profileMap.get(p.creator_id) ?? null,
  }));
}

export async function getAdminFinanceSummary(
  admin: SupabaseClient,
): Promise<AdminFinanceSummary> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: payments } = await admin
    .from("payments")
    .select("amount_kobo")
    .eq("status", "success")
    .gte("created_at", thirtyDaysAgo);

  const { count: subCount } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .in("status", ["trialing", "active", "past_due"]);

  const { data: payoutsCompleted } = await admin
    .from("payout_requests")
    .select("net_amount_kobo")
    .eq("status", "completed")
    .gte("processed_at", thirtyDaysAgo);

  const { data: payoutsPending } = await admin
    .from("payout_requests")
    .select("amount_kobo")
    .in("status", ["pending", "review", "processing"]);

  const { data: earnings } = await admin
    .from("earnings_daily")
    .select("platform_fee_kobo, net_kobo")
    .gte("date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));

  const payments_success_kobo = (payments ?? []).reduce(
    (s, p) => s + (p.amount_kobo ?? 0),
    0,
  );
  const payouts_completed_kobo = (payoutsCompleted ?? []).reduce(
    (s, p) => s + (p.net_amount_kobo ?? 0),
    0,
  );
  const payouts_pending_kobo = (payoutsPending ?? []).reduce(
    (s, p) => s + (p.amount_kobo ?? 0),
    0,
  );
  const platform_net_30d_kobo = (earnings ?? []).reduce(
    (s, e) => s + (e.net_kobo ?? 0),
    0,
  );

  return {
    payments_success_kobo,
    payments_count: payments?.length ?? 0,
    payouts_completed_kobo,
    payouts_pending_kobo,
    platform_net_30d_kobo,
    active_subscriptions: subCount ?? 0,
  };
}

export async function listAdminAuditLogs(
  admin: SupabaseClient,
  limit = 80,
): Promise<AdminAuditRow[]> {
  const { data, error } = await admin
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_type, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as AdminAuditRow[];
}

export async function getAdminAnalytics(
  admin: SupabaseClient,
): Promise<{
  signupsByDay: { date: string; count: number }[];
  revenueByDay: { date: string; gross_kobo: number }[];
  topCreators: { creator_id: string; username: string; net_kobo: number }[];
}> {
  const { data: profiles } = await admin
    .from("profiles")
    .select("created_at")
    .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString())
    .is("deleted_at", null);

  const signupsMap = new Map<string, number>();
  for (const p of profiles ?? []) {
    const day = p.created_at.slice(0, 10);
    signupsMap.set(day, (signupsMap.get(day) ?? 0) + 1);
  }
  const signupsByDay = [...signupsMap.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const { data: earnings } = await admin
    .from("earnings_daily")
    .select("date, gross_kobo, creator_id")
    .gte("date", new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10));

  const revenueMap = new Map<string, number>();
  const creatorTotals = new Map<string, number>();

  for (const e of earnings ?? []) {
    const day = String(e.date);
    revenueMap.set(day, (revenueMap.get(day) ?? 0) + (e.gross_kobo ?? 0));
    creatorTotals.set(
      e.creator_id,
      (creatorTotals.get(e.creator_id) ?? 0) + (e.gross_kobo ?? 0),
    );
  }

  const revenueByDay = [...revenueMap.entries()]
    .map(([date, gross_kobo]) => ({ date, gross_kobo }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topIds = [...creatorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  const { data: creatorProfiles } = await admin
    .from("profiles")
    .select("id, username")
    .in("id", topIds);

  const usernameMap = new Map(
    (creatorProfiles ?? []).map((p) => [p.id, p.username]),
  );

  const topCreators = topIds.map((creator_id) => ({
    creator_id,
    username: usernameMap.get(creator_id) ?? "unknown",
    net_kobo: creatorTotals.get(creator_id) ?? 0,
  }));

  return { signupsByDay, revenueByDay, topCreators };
}
