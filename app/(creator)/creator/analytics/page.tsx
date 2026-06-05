import { redirect } from "next/navigation";

import { BarChart } from "@/components/analytics/bar-chart";
import { StatCard } from "@/components/analytics/stat-card";
import { TopPostsTable } from "@/components/analytics/top-posts-table";
import { requireAuth } from "@/lib/auth/get-auth-context";
import {
  getAnalyticsSummary,
  getEarningsByMonth,
  getSubscriberGrowthByMonth,
  getTopPosts,
  formatNgnFromKobo,
} from "@/lib/analytics/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CreatorAnalyticsPage() {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") redirect("/settings");

  const [summary, subscriberGrowth, earningsByMonth, topPosts] =
    await Promise.all([
      getAnalyticsSummary(supabase, auth.userId),
      getSubscriberGrowthByMonth(supabase, auth.userId, 6),
      getEarningsByMonth(supabase, auth.userId, 6),
      getTopPosts(supabase, auth.userId, 10),
    ]);

  const maxSubscribers = Math.max(...subscriberGrowth.map((p) => p.value), 1);
  const maxEarnings = Math.max(
    ...earningsByMonth.map((p) => p.gross_kobo),
    1,
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-2 text-muted-foreground">
          Subscriber growth, earnings, and your best-performing content.
        </p>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active subscribers"
          value={summary.activeSubscribers.toLocaleString("en-NG")}
          sub={`+${summary.newSubscribersThisMonth} this month`}
        />
        <StatCard
          label="New this month"
          value={summary.newSubscribersThisMonth.toLocaleString("en-NG")}
          sub="subscribers joined"
        />
        <StatCard
          label="Net earnings this month"
          value={formatNgnFromKobo(summary.netEarningsThisMonth)}
          sub="after platform fees"
        />
        <StatCard
          label="Lifetime earned"
          value={formatNgnFromKobo(summary.lifetimeEarnings)}
          sub="total credited to wallet"
        />
      </div>

      {/* ── Subscriber growth ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Subscriber growth</h2>
          <p className="text-sm text-muted-foreground">
            New subscriptions per month — last 6 months
          </p>
        </div>
        <div className="rounded-xl border p-5">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <span className="inline-block h-3 w-3 rounded-sm bg-primary" />
            <span className="text-muted-foreground">New subscribers</span>
            <span className="ml-auto font-semibold">
              {subscriberGrowth.reduce((s, p) => s + p.value, 0)} total
            </span>
          </div>
          <BarChart
            points={subscriberGrowth.map((p) => ({
              label: p.label,
              series: [{ value: p.value, color: "bg-primary" }],
            }))}
            formatValue={(v) => (v === 0 ? "" : String(v))}
            emptyMessage="No subscribers yet — share your profile to get started."
          />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center text-sm sm:grid-cols-6">
            {subscriberGrowth.map((p) => (
              <div key={p.month}>
                <p className="font-semibold">{p.value}</p>
                <p className="text-xs text-muted-foreground">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Earnings by month ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Earnings by month</h2>
          <p className="text-sm text-muted-foreground">
            Gross vs net revenue — last 6 months
          </p>
        </div>
        <div className="rounded-xl border p-5">
          <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/50" />
              <span className="text-muted-foreground">Gross</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-600" />
              <span className="text-muted-foreground">Net (after fees)</span>
            </div>
            <span className="ml-auto font-semibold">
              {formatNgnFromKobo(
                earningsByMonth.reduce((s, p) => s + p.net_kobo, 0),
              )}{" "}
              net
            </span>
          </div>
          <BarChart
            points={earningsByMonth.map((p) => ({
              label: p.label,
              series: [
                { value: p.gross_kobo, color: "bg-emerald-500/50", label: "Gross" },
                { value: p.net_kobo, color: "bg-emerald-600", label: "Net" },
              ],
            }))}
            formatValue={(v) =>
              v === 0 ? "" : formatNgnFromKobo(v)
            }
            emptyMessage="No earnings yet — publish content and set up subscription plans."
          />
          <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 sm:grid-cols-6">
            {earningsByMonth.map((p) => (
              <div key={p.month} className="text-center text-sm">
                <p className="font-semibold">
                  {formatNgnFromKobo(p.net_kobo)}
                </p>
                <p className="text-xs text-muted-foreground">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Top posts ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Top posts</h2>
          <p className="text-sm text-muted-foreground">
            Ranked by total engagement (likes + comments)
          </p>
        </div>
        <TopPostsTable posts={topPosts} />
      </section>
    </div>
  );
}
