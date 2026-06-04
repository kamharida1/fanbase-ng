"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { adminUpdateCreator } from "@/lib/admin/actions";
import { formatAdminDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import type { AdminCreatorRow } from "@/types/admin";

export function CreatorsManager({
  creators,
  total,
  page,
  q,
}: {
  creators: AdminCreatorRow[];
  total: number;
  page: number;
  q: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(
    userId: string,
    patch: {
      isVerified?: boolean;
      isAcceptingSubscribers?: boolean;
      feedPriority?: number;
    },
  ) {
    setLoadingId(userId);
    setError(null);
    const result = await adminUpdateCreator({ userId, ...patch });
    setLoadingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams();
          if (search.trim()) params.set("q", search.trim());
          router.push(`/admin/creators?${params.toString()}`);
        }}
      >
        <input
          className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="Search creators…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit">Search</Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-sm text-muted-foreground">{total} creators</p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">Creator</th>
              <th className="p-3">Verified</th>
              <th className="p-3">Subs open</th>
              <th className="p-3">Feed priority</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {creators.map((c) => (
              <tr key={c.user_id} className="border-b last:border-0">
                <td className="p-3">
                  <p className="font-medium">@{c.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.display_name ?? c.user_id.slice(0, 8)}
                  </p>
                </td>
                <td className="p-3">{c.is_verified ? "Yes" : "No"}</td>
                <td className="p-3">
                  {c.is_accepting_subscribers ? "Yes" : "No"}
                </td>
                <td className="p-3">{c.feed_priority}</td>
                <td className="p-3">{formatAdminDate(c.created_at)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === c.user_id}
                      onClick={() =>
                        void patch(c.user_id, {
                          isVerified: !c.is_verified,
                        })
                      }
                    >
                      {c.is_verified ? "Unverify" : "Verify"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === c.user_id}
                      onClick={() =>
                        void patch(c.user_id, {
                          isAcceptingSubscribers: !c.is_accepting_subscribers,
                        })
                      }
                    >
                      Toggle subs
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        {page > 1 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams({ page: String(page - 1) });
              if (q) params.set("q", q);
              router.push(`/admin/creators?${params}`);
            }}
          >
            Previous
          </Button>
        ) : null}
      </div>
    </div>
  );
}
