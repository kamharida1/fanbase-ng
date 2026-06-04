"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { subscribeToNotifications } from "@/lib/notifications/realtime";
import type { NotificationRow } from "@/types/notifications";

export function NotificationBell({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications/unread-count");
      const json = (await res.json()) as { data?: { count: number } };
      if (res.ok && json.data) {
        setUnread(json.data.count);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const supabase = createClient();

    const channel = subscribeToNotifications(supabase, userId, {
      onInsert: (row: NotificationRow) => {
        if (!row.read_at) {
          setUnread((c) => c + 1);
        }
      },
      onUpdate: (row: NotificationRow) => {
        if (row.read_at) {
          void refreshCount();
        }
      },
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshCount]);

  return (
    <Link
      href="/notifications"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted"
      aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
