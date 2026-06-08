"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { adminResolveDispute } from "@/lib/admin/actions";
import { formatAdminDate, formatAdminMoney } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import type { AdminDisputeRow } from "@/types/admin";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
  closed: "bg-muted text-muted-foreground",
};

export function DisputesPanel({ disputes }: { disputes: AdminDisputeRow[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(disputeId: string, outcome: "won" | "lost" | "closed") {
    setLoadingId(disputeId);
    setError(null);
    const result = await adminResolveDispute({
      disputeId,
      outcome,
      notes: notes.trim() || undefined,
    });
    setLoadingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setActiveId(null);
    setNotes("");
    router.refresh();
  }

  if (disputes.length === 0) {
    return <p className="text-muted-foreground">No payment disputes.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y rounded-xl border">
        {disputes.map((d) => (
          <li key={d.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  {formatAdminMoney(d.amount_kobo)}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      STATUS_BADGE[d.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {d.status}
                  </span>
                  {d.needs_manual_review ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                      needs review
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  Creator{" "}
                  {d.creator_id ? (
                    <Link href={`/admin/wallets/${d.creator_id}`} className="hover:underline">
                      @{d.creator_username ?? "?"}
                    </Link>
                  ) : (
                    <>@{d.creator_username ?? "?"}</>
                  )}{" "}
                  · Fan @{d.fan_username ?? "?"}
                </p>
                {d.reason ? (
                  <p className="mt-1 text-sm">Reason: {d.reason}</p>
                ) : null}
                {d.resolution_notes ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Notes: {d.resolution_notes}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Opened {formatAdminDate(d.created_at)}
                  {d.evidence_due_at
                    ? ` · Evidence due ${formatAdminDate(d.evidence_due_at)}`
                    : ""}
                  {d.resolved_at ? ` · Resolved ${formatAdminDate(d.resolved_at)}` : ""}
                </p>
              </div>

              {d.status === "open" ? (
                activeId === d.id ? (
                  <div className="flex w-full max-w-sm flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Resolution notes (optional)"
                      className="min-h-16 rounded-md border bg-background p-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={loadingId === d.id}
                        onClick={() => void resolve(d.id, "won")}
                      >
                        Creator won — release funds
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={loadingId === d.id}
                        onClick={() => void resolve(d.id, "lost")}
                      >
                        Creator lost — debit &amp; revoke access
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingId === d.id}
                        onClick={() => void resolve(d.id, "closed")}
                      >
                        Close — release funds
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loadingId === d.id}
                        onClick={() => {
                          setActiveId(null);
                          setNotes("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveId(d.id);
                      setNotes("");
                      setError(null);
                    }}
                  >
                    Resolve
                  </Button>
                )
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
