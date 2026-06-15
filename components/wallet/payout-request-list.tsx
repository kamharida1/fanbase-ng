import { formatNgnFromKobo, payoutStatusDescription, payoutStatusLabel } from "@/lib/wallets/format";
import type { PayoutRequestRow } from "@/types/wallet";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export function PayoutRequestList({ requests }: { requests: PayoutRequestRow[] }) {
  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
    );
  }

  return (
    <ul className="divide-y rounded-xl border">
      {requests.map((req) => (
        <li key={req.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:justify-between">
          <div>
            <p className="font-medium">{formatNgnFromKobo(req.amount_kobo)}</p>
            {req.payout_account ? (
              <p className="text-sm text-muted-foreground">
                {req.payout_account.bank_name ?? "Bank"} · ****
                {req.payout_account.account_number_last4}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {formatWhen(req.created_at)} · Net {formatNgnFromKobo(req.net_amount_kobo)}
            </p>
            {req.failure_reason ? (
              <p className="text-xs text-destructive">{req.failure_reason}</p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <p className="text-sm font-medium capitalize">
              {payoutStatusLabel(req.status)}
            </p>
            {payoutStatusDescription(req.status) ? (
              <p className="mt-1 text-xs text-muted-foreground sm:max-w-xs sm:ml-auto">
                {payoutStatusDescription(req.status)}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
