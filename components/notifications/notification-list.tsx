"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { NotificationLiveSync } from "@/components/notifications/notification-live-sync";
import { markNotificationsReadAction } from "@/lib/notifications/actions";
import { toSafeNotificationHref } from "@/lib/security/safe-url";
import { Button } from "@/components/ui/button";
import type { NotificationRow } from "@/types/notifications";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function typeLabel(type: NotificationRow["type"]): string {
  switch (type) {
    case "new_subscriber":
      return "Subscriber";
    case "new_message":
      return "Message";
    case "new_comment":
      return "Comment";
    case "new_like":
      return "Like";
    case "new_payout":
      return "Payout";
    default:
      return "Update";
  }
}

export function NotificationList({
  userId,
  initialNotifications,
  initialCursor,
}: {
  userId: string;
  initialNotifications: NotificationRow[];
  initialCursor: string | null;
}) {
  const [items, setItems] = useState(initialNotifications);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ cursor });
      const res = await fetch(`/api/v1/notifications?${params}`);
      const json = (await res.json()) as {
        data?: {
          notifications: NotificationRow[];
          nextCursor: string | null;
        };
      };
      if (res.ok && json.data) {
        setItems((prev) => {
          const seen = new Set(prev.map((n) => n.id));
          const merged = [...prev];
          for (const n of json.data!.notifications) {
            if (!seen.has(n.id)) merged.push(n);
          }
          return merged;
        });
        setCursor(json.data.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }, [cursor, loading]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  const handleLiveInsert = useCallback((row: NotificationRow) => {
    setItems((prev) => {
      if (prev.some((n) => n.id === row.id)) return prev;
      return [row, ...prev];
    });
  }, []);

  async function markAllRead() {
    const result = await markNotificationsReadAction({ markAll: true });
    if (result.success) {
      setItems((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at ?? new Date().toISOString(),
          status: "read",
        })),
      );
    }
  }

  async function markOneRead(id: string) {
    await markNotificationsReadAction({ ids: [id] });
    setItems((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, read_at: new Date().toISOString(), status: "read" }
          : n,
      ),
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground">
        No notifications yet. Activity from subscribers, messages, and posts will
        show up here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <NotificationLiveSync userId={userId} onNotification={handleLiveInsert} />
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => void markAllRead()}>
          Mark all read
        </Button>
      </div>
      <ul className="divide-y rounded-xl border">
        {items.map((n) => {
          const unread = !n.read_at;
          const inner = (
            <div
              className={`flex flex-col gap-1 p-4 ${unread ? "bg-muted/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {typeLabel(n.type)}
                </span>
                <time className="text-xs text-muted-foreground">
                  {formatWhen(n.created_at)}
                </time>
              </div>
              <p className="break-words font-medium">{n.title}</p>
              {n.body ? (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {n.body}
                </p>
              ) : null}
            </div>
          );

          const safeHref = toSafeNotificationHref(n.action_url);

          return (
            <li key={`${n.id}-${n.created_at}`}>
              {safeHref ? (
                <Link
                  href={safeHref}
                  className="block transition-colors hover:bg-muted/60"
                  onClick={() => {
                    if (unread) void markOneRead(n.id);
                  }}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  className="block w-full text-left transition-colors hover:bg-muted/60"
                  onClick={() => {
                    if (unread) void markOneRead(n.id);
                  }}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div ref={sentinelRef} className="h-2" aria-hidden />
      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Loading…</p>
      ) : null}
    </div>
  );
}
