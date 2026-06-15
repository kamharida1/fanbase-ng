"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { adminApproveStalePendingPosts } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";

export function StalePostsBacklog({ count }: { count: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState<number | null>(null);

  if (count === 0 && approved === null) return null;

  async function handleApproveAll() {
    setLoading(true);
    setError(null);
    const result = await adminApproveStalePendingPosts();
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setApproved(result.approved ?? 0);
    router.refresh();
  }

  const remaining = approved !== null ? 0 : count;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-amber-950 dark:text-amber-100">
            {approved !== null
              ? `Approved ${approved} backlog post${approved === 1 ? "" : "s"}.`
              : `${remaining} published post${remaining === 1 ? "" : "s"} stuck in pending moderation`}
          </p>
          <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
            These were published before auto-approval and are hidden from feed and
            discover until approved.
          </p>
        </div>
        {remaining > 0 ? (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void handleApproveAll()}
            className="border-amber-400 bg-background"
          >
            {loading ? "Approving…" : "Approve all backlog"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
