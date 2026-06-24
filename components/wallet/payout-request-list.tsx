"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { cancelWithdrawal } from "@/lib/wallets/actions";
import { formatNgnFromKobo, payoutStatusDescription, payoutStatusLabel } from "@/lib/wallets/format";
import { Button } from "@/components/ui/button";
import type { PayoutRequestRow } from "@/types/wallet";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export function PayoutRequestList({ requests }: { requests: PayoutRequestRow[] }) {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No withdrawal requests yet.</p>
    );
  }

  async function handleCancel(id: string) {
    setCancellingId(id);
    setError(null);
    const result = await cancelWithdrawal(id);
    setCancellingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}
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
              {req.status === "pending" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={cancellingId === req.id}
                  onClick={() => void handleCancel(req.id)}
                >
                  {cancellingId === req.id ? "Cancelling…" : "Cancel"}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
