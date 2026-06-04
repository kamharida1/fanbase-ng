"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { adminUpdateUserStatus } from "@/lib/admin/actions";
import { formatAdminDate } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import type { AdminUserRow } from "@/types/admin";

export function UsersManager({
  users,
  total,
  page,
  q,
}: {
  users: AdminUserRow[];
  total: number;
  page: number;
  q: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(userId: string, status: "active" | "suspended" | "banned") {
    setLoadingId(userId);
    setError(null);
    const result = await adminUpdateUserStatus({ userId, status });
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
          router.push(`/admin/users?${params.toString()}`);
        }}
      >
        <input
          className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="Search username or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit">Search</Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <p className="text-sm text-muted-foreground">{total} users</p>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b bg-muted/50 text-left">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3">
                  <p className="font-medium">@{u.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.display_name ?? u.email ?? u.id.slice(0, 8)}
                  </p>
                </td>
                <td className="p-3">{u.role}</td>
                <td className="p-3">{u.status}</td>
                <td className="p-3">{formatAdminDate(u.created_at)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {u.status !== "active" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingId === u.id}
                        onClick={() => void setStatus(u.id, "active")}
                      >
                        Activate
                      </Button>
                    ) : null}
                    {u.status !== "suspended" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingId === u.id}
                        onClick={() => void setStatus(u.id, "suspended")}
                      >
                        Suspend
                      </Button>
                    ) : null}
                    {u.status !== "banned" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={loadingId === u.id}
                        onClick={() => void setStatus(u.id, "banned")}
                      >
                        Ban
                      </Button>
                    ) : null}
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
              router.push(`/admin/users?${params}`);
            }}
          >
            Previous
          </Button>
        ) : null}
        {users.length >= 25 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams({ page: String(page + 1) });
              if (q) params.set("q", q);
              router.push(`/admin/users?${params}`);
            }}
          >
            Next
          </Button>
        ) : null}
      </div>
    </div>
  );
}
