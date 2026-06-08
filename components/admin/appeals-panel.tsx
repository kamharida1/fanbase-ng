"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { adminResolveAppeal } from "@/lib/admin/actions";
import { formatAdminDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import type { AdminAppealRow } from "@/types/admin";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  denied: "bg-red-100 text-red-800",
};

export function AppealsPanel({ appeals }: { appeals: AdminAppealRow[] }) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(appealId: string, outcome: "approved" | "denied") {
    setLoadingId(appealId);
    setError(null);
    const result = await adminResolveAppeal({
      appealId,
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

  if (appeals.length === 0) {
    return <p className="text-muted-foreground">No account appeals.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y rounded-xl border">
        {appeals.map((a) => (
          <li key={a.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  @{a.username ?? "?"}
                  {a.display_name ? ` · ${a.display_name}` : ""}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      STATUS_BADGE[a.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.status}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                    was {a.account_status_at_submission}
                  </span>
                </p>
                <p className="mt-2 max-w-xl text-sm">{a.message}</p>
                {a.admin_notes ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reviewer notes: {a.admin_notes}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted {formatAdminDate(a.created_at)}
                  {a.resolved_at
                    ? ` · Resolved ${formatAdminDate(a.resolved_at)}`
                    : ""}
                  {a.current_account_status
                    ? ` · Currently ${a.current_account_status}`
                    : ""}
                </p>
              </div>

              {a.status === "pending" ? (
                activeId === a.id ? (
                  <div className="flex w-full max-w-sm flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Reviewer notes (optional, shared with the user)"
                      className="min-h-16 rounded-md border bg-background p-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={loadingId === a.id}
                        onClick={() => void resolve(a.id, "approved")}
                      >
                        Approve — reinstate account
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={loadingId === a.id}
                        onClick={() => void resolve(a.id, "denied")}
                      >
                        Deny — keep current status
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loadingId === a.id}
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
                      setActiveId(a.id);
                      setNotes("");
                      setError(null);
                    }}
                  >
                    Review
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
