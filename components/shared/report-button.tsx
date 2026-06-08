"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

import { submitReport } from "@/lib/reports/actions";
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from "@/lib/reports/schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  postId?: string;
  reportedUserId?: string;
  label?: string;
  /** Overrides the heading shown in the report panel, e.g. "Report this comment". */
  targetLabel?: string;
  className?: string;
};

export function ReportButton({ postId, reportedUserId, label = "Report", targetLabel, className }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const result = await submitReport({ reason, details: details.trim() || undefined, postId, reportedUserId });
    setLoading(false);
    if (result.success) {
      setSubmitted(true);
      setOpen(false);
    } else {
      setError(result.error);
    }
  }

  if (submitted) {
    return <span className={`text-xs text-muted-foreground ${className ?? ""}`}>Reported — thanks for letting us know.</span>;
  }

  return (
    <div className={`relative inline-block ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Flag className="h-3 w-3" />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 space-y-2 rounded-lg border bg-card p-3 text-sm shadow-lg">
          <p className="font-medium">{targetLabel ?? `Report this ${postId ? "post" : "account"}`}</p>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Add details (optional)…"
            rows={2}
            className="resize-none text-sm"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={loading} onClick={() => void handleSubmit()}>
              {loading ? "Submitting…" : "Submit report"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={loading}
              onClick={() => { setOpen(false); setError(null); }}
            >
              Cancel
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
