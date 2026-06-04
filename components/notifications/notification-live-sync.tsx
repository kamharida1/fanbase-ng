"use client";

import { useEffect } from "react";

import { createClient } from "@/lib/supabase/client";
import { subscribeToNotifications } from "@/lib/notifications/realtime";
import type { NotificationRow } from "@/types/notifications";

export function NotificationLiveSync({
  userId,
  onNotification,
}: {
  userId: string;
  onNotification: (row: NotificationRow) => void;
}) {
  useEffect(() => {
    const supabase = createClient();
    const channel = subscribeToNotifications(supabase, userId, {
      onInsert: onNotification,
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onNotification]);

  return null;
}
