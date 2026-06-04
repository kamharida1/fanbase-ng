"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  revokeSession,
  signOut,
  signOutAllDevices,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export type SessionRow = {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  last_active_at: string;
  created_at: string;
};

function formatAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  if (ua.length > 80) return `${ua.slice(0, 77)}…`;
  return ua;
}

export function SessionsManager({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRevoke(id: string) {
    startTransition(async () => {
      await revokeSession(id);
      router.refresh();
    });
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active sessions recorded yet. Sessions are tracked when you sign in.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-lg border">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium">{formatAgent(session.user_agent)}</p>
              <p className="break-words text-muted-foreground">
                Last active{" "}
                {new Date(session.last_active_at).toLocaleString("en-NG")}
                {session.ip_address ? ` · ${session.ip_address}` : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => handleRevoke(session.id)}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
        >
          Sign out
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => startTransition(() => signOutAllDevices())}
        >
          Sign out all devices
        </Button>
      </div>
    </div>
  );
}
