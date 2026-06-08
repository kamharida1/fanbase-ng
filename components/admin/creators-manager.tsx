"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { adminUpdateCreator } from "@/lib/admin/actions";
import { formatAdminDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import type { AdminCreatorRow } from "@/types/admin";

const KYC_LABELS: Record<string, string> = {
  none: "—",
  pending: "Pending",
  verified: "Approved",
  rejected: "Rejected",
};

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
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function patch(
    userId: string,
    patch: {
      isVerified?: boolean;
      isAcceptingSubscribers?: boolean;
      feedPriority?: number;
      approveVerification?: boolean;
      rejectVerification?: boolean;
      rejectionReason?: string;
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

      {/* Pending verification requests surfaced at top */}
      {creators.some((c) => c.kyc_status === "pending") && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-3 text-sm font-semibold text-amber-900 dark:text-amber-100">
            Pending verification requests
          </p>
          <ul className="space-y-3">
            {creators.filter((c) => c.kyc_status === "pending").map((c) => (
              <li key={c.user_id} className="rounded-lg border bg-background p-3 space-y-2">
                <p className="font-medium text-sm">@{c.username} {c.display_name ? `(${c.display_name})` : ""}</p>
                {c.verification_note && (
                  <p className="text-sm text-muted-foreground">{c.verification_note}</p>
                )}
                {rejectingId === c.user_id ? (
                  <div className="space-y-2">
                    <input
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="Rejection reason (shown to creator)…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={loadingId === c.user_id}
                        onClick={async () => {
                          await patch(c.user_id, { rejectVerification: true, rejectionReason: rejectReason });
                          setRejectingId(null);
                          setRejectReason("");
                        }}
                      >
                        Confirm reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={loadingId === c.user_id}
                      onClick={() => void patch(c.user_id, { approveVerification: true })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loadingId === c.user_id}
                      onClick={() => { setRejectingId(c.user_id); setRejectReason(""); }}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">Creator</th>
              <th className="p-3">Verified</th>
              <th className="p-3">Verif. request</th>
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
                  <span className={`text-xs font-medium ${c.kyc_status === "pending" ? "text-amber-600 dark:text-amber-400" : c.kyc_status === "verified" ? "text-green-600 dark:text-green-400" : c.kyc_status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                    {KYC_LABELS[c.kyc_status] ?? "—"}
                  </span>
                </td>
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
