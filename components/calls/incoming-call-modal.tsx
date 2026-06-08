"use client";

import { Phone, PhoneOff, Video } from "lucide-react";

import { Avatar } from "@/components/shared/avatar";
import type { CallPeer, CallType } from "@/types/calls";

type Props = {
  caller: CallPeer;
  callType: CallType;
  onAccept: () => void;
  onDecline: () => void;
};

export function IncomingCallModal({ caller, callType, onAccept, onDecline }: Props) {
  const displayName = caller.display_name ?? caller.username;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="flex w-72 flex-col items-center gap-6 rounded-2xl bg-card p-8 shadow-2xl">
        <Avatar src={caller.avatar_url} alt={displayName} size={80} />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Incoming {callType} call
          </p>
          <p className="mt-1 text-lg font-semibold">{displayName}</p>
          <p className="text-sm text-muted-foreground">@{caller.username}</p>
        </div>

        <div className="flex gap-8">
          <button
            onClick={onDecline}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform active:scale-95"
            aria-label="Decline call"
          >
            <PhoneOff className="h-6 w-6" />
          </button>

          <button
            onClick={onAccept}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform active:scale-95"
            aria-label="Accept call"
          >
            {callType === "video" ? (
              <Video className="h-6 w-6" />
            ) : (
              <Phone className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
