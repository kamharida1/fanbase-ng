"use client";

import { Phone, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CallType } from "@/types/calls";

type Props = {
  callType: CallType;
  disabled?: boolean;
  onClick: (callType: CallType) => void;
};

export function CallButton({ callType, disabled, onClick }: Props) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      disabled={disabled}
      onClick={() => onClick(callType)}
      title={callType === "voice" ? "Voice call" : "Video call"}
    >
      {callType === "voice" ? (
        <Phone className="h-4 w-4" />
      ) : (
        <Video className="h-4 w-4" />
      )}
    </Button>
  );
}
