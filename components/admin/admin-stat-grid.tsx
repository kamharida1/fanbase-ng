import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdminMoney } from "@/lib/admin/format";
import type { AdminDashboardStats } from "@/types/admin";

export function AdminStatGrid({ stats }: { stats: AdminDashboardStats }) {
  const items = [
    { label: "Total users", value: String(stats.users_total) },
    { label: "Active users", value: String(stats.users_active) },
    { label: "Creators", value: String(stats.creators_total) },
    { label: "Active subs", value: String(stats.subscriptions_active) },
    { label: "Moderation queue", value: String(stats.posts_pending_moderation) },
    { label: "Open reports", value: String(stats.reports_open) },
    { label: "Pending payouts", value: String(stats.payouts_pending) },
    {
      label: "Payments (30d)",
      value: formatAdminMoney(stats.payments_30d_kobo),
    },
    {
      label: "Payouts out (30d)",
      value: formatAdminMoney(stats.payouts_completed_30d_kobo),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
