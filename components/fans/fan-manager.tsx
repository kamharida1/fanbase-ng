"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, ShieldCheck } from "lucide-react";

import { blockFan, unblockFan } from "@/lib/fans/actions";
import { Avatar } from "@/components/shared/avatar";
import { Button } from "@/components/ui/button";
import type { SubscriberRow } from "@/lib/fans/queries";

export function FanManager({ fans }: { fans: SubscriberRow[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(fan: SubscriberRow) {
    setLoadingId(fan.fan_id);
    setError(null);
    const result = fan.is_blocked
      ? await unblockFan(fan.fan_id)
      : await blockFan(fan.fan_id);
    setLoadingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (!fans.length) {
    return (
      <p className="text-muted-foreground">
        No fans yet. Share your profile to get your first subscribers.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y rounded-xl border">
        {fans.map((fan) => {
          const label = fan.display_name ?? fan.username;
          return (
            <li
              key={fan.fan_id}
              className="flex min-w-0 items-center gap-4 p-4"
            >
              <Avatar
                src={fan.avatar_url}
                alt={label}
                size={40}
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{label}</p>
                <p className="truncate text-sm text-muted-foreground">
                  @{fan.username} ·{" "}
                  <span className="capitalize">{fan.subscription_status}</span>
                </p>
              </div>
              {fan.is_blocked ? (
                <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  Blocked
                </span>
              ) : null}
              <Button
                size="sm"
                variant={fan.is_blocked ? "outline" : "ghost"}
                disabled={loadingId === fan.fan_id}
                onClick={() => toggle(fan)}
                className="shrink-0 gap-1.5"
              >
                {fan.is_blocked ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Unblock
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-3.5 w-3.5" />
                    Block
                  </>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
