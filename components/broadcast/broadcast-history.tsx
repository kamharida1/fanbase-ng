import { CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react";

import { formatNgnFromKobo } from "@/lib/creators/format";
import type { BroadcastRecord } from "@/lib/broadcast/actions";

const STATUS_META: Record<
  BroadcastRecord["status"],
  { label: string; icon: React.ReactNode; className: string }
> = {
  completed: {
    label: "Delivered",
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: "text-green-600 dark:text-green-400",
  },
  partial: {
    label: "Partial",
    icon: <AlertCircle className="h-4 w-4" />,
    className: "text-amber-600 dark:text-amber-400",
  },
  sending: {
    label: "Sending…",
    icon: <Clock className="h-4 w-4 animate-pulse" />,
    className: "text-muted-foreground",
  },
  failed: {
    label: "Failed",
    icon: <XCircle className="h-4 w-4" />,
    className: "text-destructive",
  },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function BroadcastHistory({
  broadcasts,
}: {
  broadcasts: BroadcastRecord[];
}) {
  if (!broadcasts.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No broadcasts sent yet. Your history will appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {broadcasts.map((b) => {
        const meta = STATUS_META[b.status];
        const deliveryPct =
          b.total_recipients > 0
            ? Math.round((b.sent_count / b.total_recipients) * 100)
            : 0;

        return (
          <li
            key={b.id}
            className="rounded-xl border bg-card p-4 space-y-2 text-sm"
          >
            {/* Top row: status + timestamp */}
            <div className="flex items-center justify-between gap-2">
              <span className={`flex items-center gap-1.5 font-medium ${meta.className}`}>
                {meta.icon}
                {meta.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatRelative(b.created_at)}
              </span>
            </div>

            {/* Message preview */}
            <p className="line-clamp-2 text-muted-foreground">
              {b.body}
            </p>

            {b.audience_label && (
              <p className="text-xs text-muted-foreground">
                Audience: {b.audience_label}
              </p>
            )}

            {/* Delivery stats row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">
                  {b.sent_count.toLocaleString()}
                </span>
                {" / "}
                {b.total_recipients.toLocaleString()} delivered ({deliveryPct}%)
              </span>
              {b.failed_count > 0 && (
                <span className="text-destructive">
                  {b.failed_count.toLocaleString()} failed
                </span>
              )}
              {b.is_ppv && b.ppv_price_kobo ? (
                <span className="rounded-full border px-2 py-0.5 font-medium">
                  PPV · {formatNgnFromKobo(b.ppv_price_kobo)}
                </span>
              ) : (
                <span className="rounded-full border px-2 py-0.5">Free</span>
              )}
            </div>

            {/* Delivery progress bar */}
            {b.total_recipients > 0 && (
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    b.status === "failed"
                      ? "bg-destructive"
                      : b.status === "partial"
                        ? "bg-amber-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${deliveryPct}%` }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
