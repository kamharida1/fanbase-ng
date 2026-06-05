import type { SupabaseClient } from "@supabase/supabase-js";

import { formatNgnFromKobo } from "@/lib/creators/format";

export type MonthPoint = {
  month: string;   // "2026-06"
  label: string;   // "Jun"
  value: number;
};

export type EarningsPoint = {
  month: string;
  label: string;
  gross_kobo: number;
  net_kobo: number;
};

export type TopPost = {
  id: string;
  caption: string | null;
  type: string;
  visibility: string;
  like_count: number;
  comment_count: number;
  engagement: number;
  published_at: string | null;
  ppv_price_kobo: number | null;
};

export type AnalyticsSummary = {
  activeSubscribers: number;
  newSubscribersThisMonth: number;
  netEarningsThisMonth: number;
  lifetimeEarnings: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function lastNMonths(n: number): { month: string; label: string }[] {
  const result = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-NG", { month: "short" });
    result.push({ month, label });
  }
  return result;
}

function isoToMonth(iso: string): string {
  return iso.slice(0, 7); // "2026-06-15" → "2026-06"
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getAnalyticsSummary(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<AnalyticsSummary> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    { count: activeSubscribers },
    { count: newThisMonth },
    { data: wallet },
    { data: monthEarnings },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", creatorId)
      .in("status", ["active", "trialing"]),

    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", creatorId)
      .gte("created_at", monthStart.toISOString()),

    supabase
      .from("wallets")
      .select("lifetime_credited_kobo")
      .eq("owner_id", creatorId)
      .eq("owner_type", "creator")
      .maybeSingle(),

    supabase
      .from("earnings_daily")
      .select("net_kobo")
      .eq("creator_id", creatorId)
      .gte("date", monthStart.toISOString().slice(0, 10)),
  ]);

  const netThisMonth = (monthEarnings ?? []).reduce(
    (s, r) => s + (r.net_kobo ?? 0),
    0,
  );

  return {
    activeSubscribers: activeSubscribers ?? 0,
    newSubscribersThisMonth: newThisMonth ?? 0,
    netEarningsThisMonth: netThisMonth,
    lifetimeEarnings: wallet?.lifetime_credited_kobo ?? 0,
  };
}

export async function getSubscriberGrowthByMonth(
  supabase: SupabaseClient,
  creatorId: string,
  months = 6,
): Promise<MonthPoint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("subscriptions")
    .select("created_at")
    .eq("creator_id", creatorId)
    .gte("created_at", since.toISOString());

  const countByMonth = new Map<string, number>();
  for (const row of data ?? []) {
    const m = isoToMonth(row.created_at);
    countByMonth.set(m, (countByMonth.get(m) ?? 0) + 1);
  }

  return lastNMonths(months).map(({ month, label }) => ({
    month,
    label,
    value: countByMonth.get(month) ?? 0,
  }));
}

export async function getEarningsByMonth(
  supabase: SupabaseClient,
  creatorId: string,
  months = 6,
): Promise<EarningsPoint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);
  const sinceDate = since.toISOString().slice(0, 10);

  const { data } = await supabase
    .from("earnings_daily")
    .select("date, gross_kobo, net_kobo")
    .eq("creator_id", creatorId)
    .gte("date", sinceDate);

  type Acc = { gross_kobo: number; net_kobo: number };
  const byMonth = new Map<string, Acc>();

  for (const row of data ?? []) {
    const m = isoToMonth(String(row.date));
    const prev = byMonth.get(m) ?? { gross_kobo: 0, net_kobo: 0 };
    byMonth.set(m, {
      gross_kobo: prev.gross_kobo + (row.gross_kobo ?? 0),
      net_kobo: prev.net_kobo + (row.net_kobo ?? 0),
    });
  }

  return lastNMonths(months).map(({ month, label }) => {
    const acc = byMonth.get(month) ?? { gross_kobo: 0, net_kobo: 0 };
    return { month, label, ...acc };
  });
}

export async function getTopPosts(
  supabase: SupabaseClient,
  creatorId: string,
  limit = 10,
): Promise<TopPost[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, caption, type, visibility, stats_cache, published_at, ppv_price_kobo",
    )
    .eq("creator_id", creatorId)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50); // fetch more, sort in JS

  if (error || !data) return [];

  return data
    .map((p) => {
      const stats = (p.stats_cache ?? {}) as {
        likes?: number;
        comments?: number;
      };
      const likes = stats.likes ?? 0;
      const comments = stats.comments ?? 0;
      return {
        id: p.id,
        caption: p.caption,
        type: p.type,
        visibility: p.visibility,
        like_count: likes,
        comment_count: comments,
        engagement: likes + comments,
        published_at: p.published_at,
        ppv_price_kobo: p.ppv_price_kobo,
      };
    })
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, limit);
}

export { formatNgnFromKobo };
