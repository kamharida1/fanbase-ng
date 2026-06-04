import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdminMoney } from "@/lib/admin/format";
import type { AdminFinanceSummary } from "@/types/admin";

export function FinancePanel({ summary }: { summary: AdminFinanceSummary }) {
  const cards = [
    {
      label: "Successful payments (30d)",
      value: formatAdminMoney(summary.payments_success_kobo),
      sub: `${summary.payments_count} transactions`,
    },
    {
      label: "Completed payouts (30d)",
      value: formatAdminMoney(summary.payouts_completed_kobo),
    },
    {
      label: "Pending payout volume",
      value: formatAdminMoney(summary.payouts_pending_kobo),
    },
    {
      label: "Creator net earnings (30d)",
      value: formatAdminMoney(summary.platform_net_30d_kobo),
    },
    {
      label: "Active subscriptions",
      value: String(summary.active_subscriptions),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{c.value}</p>
            {c.sub ? (
              <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
