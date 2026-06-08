"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { submitAppeal } from "@/lib/appeals/actions";
import { Button } from "@/components/ui/button";
import type { AccountAppealRow } from "@/lib/appeals/queries";

const STATUS_COPY: Record<AccountAppealRow["status"], string> = {
  pending: "Your appeal is pending review. We'll notify you once it's resolved.",
  approved:
    "Your appeal was approved and your account has been reinstated. You can sign back in now.",
  denied:
    "Your appeal was denied and the original decision on your account stands.",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AppealForm({ appeal }: { appeal: AccountAppealRow | null }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const hasOpenAppeal = appeal?.status === "pending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await submitAppeal({ message });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
    setMessage("");
    router.refresh();
  }

  if (appeal) {
    return (
      <div className="space-y-4 rounded-xl border p-5">
        <p
          className={
            appeal.status === "denied"
              ? "text-sm text-destructive"
              : "text-sm"
          }
        >
          {STATUS_COPY[appeal.status]}
        </p>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-medium">Your appeal</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {appeal.message}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Submitted {formatDate(appeal.created_at)}
          </p>
        </div>
        {appeal.admin_notes ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Reviewer notes</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
              {appeal.admin_notes}
            </p>
          </div>
        ) : null}
        {!hasOpenAppeal && appeal.status === "denied" ? (
          <p className="text-sm text-muted-foreground">
            If you have new information to share, you can submit a new appeal
            below.
          </p>
        ) : null}
        {!hasOpenAppeal && appeal.status === "denied" ? (
          <AppealComposer
            message={message}
            setMessage={setMessage}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
          />
        ) : null}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-xl border p-5 text-sm">
        Your appeal has been submitted. We&apos;ll notify you once it&apos;s
        been reviewed.
      </div>
    );
  }

  return (
    <AppealComposer
      message={message}
      setMessage={setMessage}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}

function AppealComposer({
  message,
  setMessage,
  submitting,
  error,
  onSubmit,
}: {
  message: string;
  setMessage: (v: string) => void;
  submitting: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border p-5">
      <label htmlFor="appeal-message" className="text-sm font-medium">
        Tell us why you think this decision should be reviewed
      </label>
      <textarea
        id="appeal-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Explain your situation in detail — context helps our team review your case fairly."
        className="min-h-32 w-full rounded-md border bg-background p-3 text-sm"
        minLength={20}
        maxLength={2000}
        required
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={submitting || message.trim().length < 20}>
        {submitting ? "Submitting…" : "Submit appeal"}
      </Button>
    </form>
  );
}
