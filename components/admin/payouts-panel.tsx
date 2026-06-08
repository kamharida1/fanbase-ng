"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { adminReviewPayout } from "@/lib/admin/actions";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import type { AdminPayoutRow } from "@/types/admin";

export function PayoutsPanel({ payouts }: { payouts: AdminPayoutRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(
    requestId: string,
    action: "approve" | "reject",
  ) {
    setLoadingId(requestId);
    setError(null);
    const result = await adminReviewPayout({
      requestId,
      action,
      reason: action === "reject" ? "Rejected by admin" : undefined,
    });
    setLoadingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {payouts.length === 0 ? (
        <p className="text-muted-foreground">No payout requests.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/50 text-left">
              <tr>
                <th className="p-3">Creator</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Net</th>
                <th className="p-3">Risk</th>
                <th className="p-3">Status</th>
                <th className="p-3">Requested</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Link href={`/admin/wallets/${p.creator_id}`} className="hover:underline">
                      @{p.creator_username ?? "?"}
                    </Link>
                  </td>
                  <td className="p-3">{formatAdminMoney(p.amount_kobo)}</td>
                  <td className="p-3">{formatAdminMoney(p.net_amount_kobo)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {p.open_disputes_count > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {p.open_disputes_count} open dispute
                          {p.open_disputes_count > 1 ? "s" : ""}
                        </span>
                      ) : null}
                      {p.wallet_held_kobo > 0 ? (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                          Held {formatAdminMoney(p.wallet_held_kobo)}
                        </span>
                      ) : null}
                      {p.wallet_debt_kobo > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Debt {formatAdminMoney(p.wallet_debt_kobo)}
                        </span>
                      ) : null}
                      {p.open_disputes_count === 0 && p.wallet_held_kobo === 0 && p.wallet_debt_kobo === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3">{p.status}</td>
                  <td className="p-3">{formatAdminDate(p.created_at)}</td>
                  <td className="p-3">
                    {["pending", "review"].includes(p.status) ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          disabled={loadingId === p.id}
                          onClick={() => void review(p.id, "approve")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={loadingId === p.id}
                          onClick={() => void review(p.id, "reject")}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {p.failure_reason ?? "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
