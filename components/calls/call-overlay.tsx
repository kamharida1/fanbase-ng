"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, Video, VideoOff } from "lucide-react";

import { Avatar } from "@/components/shared/avatar";
import type { CallPhase } from "@/lib/calls/use-call";
import type { CallPeer, CallType } from "@/types/calls";

type Props = {
  peer: CallPeer;
  callType: CallType;
  phase: CallPhase;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  callDuration: number;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onHangUp: () => void;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function CallOverlay({
  peer,
  callType,
  phase,
  localStream,
  remoteStream,
  isMuted,
  isCameraOff,
  callDuration,
  onToggleMute,
  onToggleCamera,
  onHangUp,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const displayName = peer.display_name ?? peer.username;
  const statusLabel =
    phase === "calling" ? "Calling…"
    : phase === "connecting" ? "Connecting…"
    : phase === "active" ? formatDuration(callDuration)
    : "Call ended";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Remote video / voice avatar */}
      <div className="relative flex-1">
        {callType === "video" && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Avatar src={peer.avatar_url} alt={displayName} size={112} />
            <p className="text-xl font-semibold text-white">{displayName}</p>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute left-0 right-0 top-6 flex justify-center">
          <span className="rounded-full bg-black/50 px-4 py-1 text-sm text-white">
            {statusLabel}
          </span>
        </div>

        {/* Local video PiP — video calls only */}
        {callType === "video" && localStream && (
          <div className="absolute bottom-4 right-4 h-28 w-20 overflow-hidden rounded-xl border-2 border-white/30 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-8 bg-black pb-10 pt-6">
        <ControlButton
          onClick={onToggleMute}
          active={isMuted}
          label={isMuted ? "Unmute" : "Mute"}
          icon={isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        />

        {callType === "video" && (
          <ControlButton
            onClick={onToggleCamera}
            active={isCameraOff}
            label={isCameraOff ? "Camera on" : "Camera off"}
            icon={
              isCameraOff ? (
                <VideoOff className="h-6 w-6" />
              ) : (
                <Video className="h-6 w-6" />
              )
            }
          />
        )}

        <button
          onClick={onHangUp}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg transition-transform active:scale-95"
          aria-label="Hang up"
        >
          <Phone className="h-7 w-7 rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}

function ControlButton({
  onClick,
  active,
  label,
  icon,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-full transition-colors ${
        active ? "bg-white/20 text-white" : "bg-white/10 text-white/70"
      }`}
      aria-label={label}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}
