"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { adminModeratePost } from "@/lib/admin/actions";
import { formatAdminDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import type { AdminModerationItem } from "@/types/admin";

export function ModerationPanel({ items }: { items: AdminModerationItem[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moderate(
    postId: string,
    action: "approve" | "reject" | "remove",
  ) {
    setLoadingId(postId);
    setError(null);
    const result = await adminModeratePost({ postId, action });
    setLoadingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground">Moderation queue is empty.</p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.queue_id}
            className="rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Priority {item.priority_score} · {item.visibility} ·{" "}
                  {formatAdminDate(item.created_at)}
                </p>
                <p className="mt-1 font-medium">
                  @{item.creator_username ?? "unknown"}
                </p>
                <p className="mt-2 text-sm line-clamp-3">
                  {item.caption || "(no caption)"}
                </p>
              </div>
              {item.post_id ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={loadingId === item.post_id}
                    onClick={() => void moderate(item.post_id!, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingId === item.post_id}
                    onClick={() => void moderate(item.post_id!, "reject")}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={loadingId === item.post_id}
                    onClick={() => void moderate(item.post_id!, "remove")}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
