"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { adminResolveReport } from "@/lib/admin/actions";
import { formatAdminDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import type { AdminReportRow } from "@/types/admin";

export function ReportsPanel({ reports }: { reports: AdminReportRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(
    reportId: string,
    status: "resolved" | "dismissed",
  ) {
    setLoadingId(reportId);
    setError(null);
    const result = await adminResolveReport({ reportId, status });
    setLoadingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (reports.length === 0) {
    return <p className="text-muted-foreground">No open reports.</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y rounded-xl border">
        {reports.map((r) => (
          <li key={r.id} className="p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-medium capitalize">
                  {r.reason.replace("_", " ")} · {r.status}
                </p>
                <p className="text-sm text-muted-foreground">
                  Reporter @{r.reporter_username ?? "?"} →{" "}
                  {r.reported_username
                    ? `@${r.reported_username}`
                    : r.post_id
                      ? `post ${r.post_id.slice(0, 8)}`
                      : "—"}
                </p>
                {r.details ? (
                  <p className="mt-2 text-sm">{r.details}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatAdminDate(r.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={loadingId === r.id}
                  onClick={() => void resolve(r.id, "resolved")}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingId === r.id}
                  onClick={() => void resolve(r.id, "dismissed")}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
