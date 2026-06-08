import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdminMoney } from "@/lib/admin/format";
import type { AdminCreatorDebtRow, AdminFinanceSummary } from "@/types/admin";

export function FinancePanel({
  summary,
  creatorDebts,
}: {
  summary: AdminFinanceSummary;
  creatorDebts: AdminCreatorDebtRow[];
}) {
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
    {
      label: "Outstanding creator balances",
      value: formatAdminMoney(summary.total_debt_kobo),
      sub:
        summary.creators_with_debt_count > 0
          ? `${summary.creators_with_debt_count} creator(s) owe back refunded/disputed earnings`
          : undefined,
    },
  ];

  return (
    <div className="space-y-6">
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

      {creatorDebts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Creators with outstanding balances
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These creators withdrew earnings that were later refunded or
              clawed back via a lost dispute. The shortfall is recovered
              automatically from their future earnings, and withdrawals are
              blocked until it clears.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
              {creatorDebts.map((d) => (
                <li
                  key={d.creator_id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                >
                  <Link href={`/admin/wallets/${d.creator_id}`} className="font-medium hover:underline">
                    @{d.creator_username ?? "?"}
                  </Link>
                  <span className="text-destructive">
                    Owes {formatAdminMoney(d.debt_kobo)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Available {formatAdminMoney(d.available_kobo)} · Pending{" "}
                    {formatAdminMoney(d.pending_kobo)} · Held{" "}
                    {formatAdminMoney(d.held_kobo)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
