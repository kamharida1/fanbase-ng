import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin/format";
import type { AdminDisputeRow, AdminPayoutRow, AdminWalletDetail } from "@/types/admin";
import type { WalletTransactionRow } from "@/types/wallet";

const TX_LABEL: Record<string, string> = {
  dispute_hold: "Dispute hold placed",
  dispute_release: "Dispute hold released",
  dispute_debit: "Dispute lost — debited",
  debt_incurred: "Debt incurred",
  debt_recovered: "Debt recovered",
  refund_debit: "Refund debited",
  payout_debit: "Payout sent",
  clearance_credit: "Earnings cleared",
  adjustment_credit: "Manual adjustment (credit)",
  adjustment_debit: "Manual adjustment (debit)",
};

function txLabel(type: string): string {
  return TX_LABEL[type] ?? type.replace(/_/g, " ");
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
  closed: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-800",
  review: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        STATUS_BADGE[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export function WalletLedgerPanel({
  wallet,
  transactions,
  disputes,
  payouts,
}: {
  wallet: AdminWalletDetail;
  transactions: WalletTransactionRow[];
  disputes: AdminDisputeRow[];
  payouts: AdminPayoutRow[];
}) {
  const balanceCards = [
    { label: "Available", value: wallet.available_kobo },
    { label: "Pending", value: wallet.pending_kobo },
    { label: "Held (disputes)", value: wallet.held_kobo },
    { label: "Debt owed", value: wallet.debt_kobo, destructive: wallet.debt_kobo > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balanceCards.map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-xl font-bold ${c.destructive ? "text-destructive" : ""}`}>
                {formatAdminMoney(c.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disputes</CardTitle>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No disputes for this creator.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {disputes.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {formatAdminMoney(d.amount_kobo)}
                    <StatusBadge status={d.status} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Opened {formatAdminDate(d.created_at)}
                    {d.resolved_at ? ` · Resolved ${formatAdminDate(d.resolved_at)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payout requests</CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payout requests for this creator.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {formatAdminMoney(p.net_amount_kobo)}
                    <StatusBadge status={p.status} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Requested {formatAdminDate(p.created_at)}
                    {p.failure_reason ? ` · ${p.failure_reason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wallet ledger</CardTitle>
          <p className="text-sm text-muted-foreground">
            Most recent {transactions.length} transactions, newest first.
          </p>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet transactions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Type</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Available after</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="p-3">{txLabel(tx.type)}</td>
                      <td className={`p-3 ${tx.amount_kobo < 0 ? "text-destructive" : "text-emerald-700"}`}>
                        {tx.amount_kobo < 0 ? "-" : "+"}
                        {formatAdminMoney(Math.abs(tx.amount_kobo))}
                      </td>
                      <td className="p-3">{formatAdminMoney(tx.balance_available_after_kobo)}</td>
                      <td className="p-3 text-muted-foreground">{tx.description ?? "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {formatAdminDate(tx.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
