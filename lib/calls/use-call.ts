"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import {
  sendSignal,
  subscribeToCallChannel,
  unsubscribeChannel,
} from "@/lib/calls/signaling";
import type { CallType } from "@/types/calls";

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export type CallPhase =
  | "idle"
  | "calling"   // caller: sent invite, waiting for accept
  | "ringing"   // callee: received invite, showing incoming UI
  | "connecting" // accepted, setting up WebRTC
  | "active"
  | "ended";

export type UseCallReturn = {
  phase: CallPhase;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  callDuration: number; // seconds
  toggleMute: () => void;
  toggleCamera: () => void;
  hangUp: () => void;
  /** Caller: call this after startCall() server action succeeds. */
  initiatePeerConnection: (callId: string, callType: CallType) => Promise<void>;
  /** Callee: call this when the user taps "accept". */
  acceptPeerConnection: (callId: string, callType: CallType) => Promise<void>;
  /** Reset to idle (after call ends or is declined). */
  reset: () => void;
};

export function useCall(
  supabase: SupabaseClient,
  onHangUp?: (callId: string) => void,
): UseCallReturn {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<CallType>("voice");
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const stopLocalStream = useCallback(() => {
    activeStreamRef.current?.getTracks().forEach((t) => t.stop());
    activeStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const closePeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
  }, []);

  const closeCallChannel = useCallback(() => {
    if (channelRef.current) {
      unsubscribeChannel(supabase, channelRef.current);
      channelRef.current = null;
    }
  }, [supabase]);

  const teardown = useCallback(() => {
    stopDurationTimer();
    closePeerConnection();
    closeCallChannel();
    stopLocalStream();
    setCallDuration(0);
  }, [stopDurationTimer, closePeerConnection, closeCallChannel, stopLocalStream]);

  const reset = useCallback(() => {
    teardown();
    setPhase("idle");
    callIdRef.current = null;
  }, [teardown]);

  const hangUp = useCallback(() => {
    const callId = callIdRef.current;
    if (!callId) return;

    if (channelRef.current) {
      sendSignal(channelRef.current, { type: "hangup", callId }).catch(() => {});
    }

    setPhase("ended");
    teardown();
    onHangUp?.(callId);
    callIdRef.current = null;
  }, [teardown, onHangUp]);

  const startDurationTimer = useCallback(() => {
    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      setCallDuration((s) => s + 1);
    }, 1000);
  }, []);

  const getMedia = useCallback(async (callType: CallType): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints =
      callType === "video"
        ? { audio: true, video: { facingMode: "user" } }
        : { audio: true, video: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    activeStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const buildPeerConnection = useCallback(
    (callId: string, stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection(STUN_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const remote = new MediaStream();
      setRemoteStream(remote);

      pc.ontrack = ({ track }) => {
        remote.addTrack(track);
        setRemoteStream(new MediaStream(remote.getTracks()));
      };

      pc.onicecandidate = ({ candidate }) => {
        if (!candidate || !channelRef.current) return;
        sendSignal(channelRef.current, {
          type: "ice-candidate",
          callId,
          candidate: candidate.toJSON(),
        }).catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setPhase("active");
          startDurationTimer();
        } else if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          setPhase("ended");
          teardown();
        }
      };

      return pc;
    },
    [startDurationTimer, teardown],
  );

  /** Caller side: create offer and subscribe to call channel. */
  const initiatePeerConnection = useCallback(
    async (callId: string, callType: CallType) => {
      callIdRef.current = callId;
      callTypeRef.current = callType;
      setPhase("calling");

      const stream = await getMedia(callType);
      const pc = buildPeerConnection(callId, stream);

      const channel = subscribeToCallChannel(supabase, callId, async (signal) => {
        if (signal.type === "accept" && signal.callId === callId) {
          setPhase("connecting");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal(channel, {
            type: "offer",
            callId,
            sdp: offer.sdp ?? "",
          });
        } else if (signal.type === "answer" && signal.callId === callId) {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: signal.sdp }),
          );
        } else if (signal.type === "ice-candidate" && signal.callId === callId) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else if (signal.type === "hangup" && signal.callId === callId) {
          setPhase("ended");
          teardown();
          onHangUp?.(callId);
        } else if (signal.type === "decline" && signal.callId === callId) {
          setPhase("ended");
          teardown();
          callIdRef.current = null;
        }
      });
      channelRef.current = channel;
    },
    [supabase, getMedia, buildPeerConnection, teardown, onHangUp],
  );

  /** Callee side: subscribe to call channel, then answer the offer. */
  const acceptPeerConnection = useCallback(
    async (callId: string, callType: CallType) => {
      callIdRef.current = callId;
      callTypeRef.current = callType;
      setPhase("connecting");

      const stream = await getMedia(callType);
      const pc = buildPeerConnection(callId, stream);

      const channel = subscribeToCallChannel(supabase, callId, async (signal) => {
        if (signal.type === "offer" && signal.callId === callId) {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: "offer", sdp: signal.sdp }),
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(channel, {
            type: "answer",
            callId,
            sdp: answer.sdp ?? "",
          });
        } else if (signal.type === "ice-candidate" && signal.callId === callId) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else if (signal.type === "hangup" && signal.callId === callId) {
          setPhase("ended");
          teardown();
          onHangUp?.(callId);
        }
      });
      channelRef.current = channel;

      // Tell caller we accepted (triggers them to create + send the offer)
      await sendSignal(channel, { type: "accept", callId });
    },
    [supabase, getMedia, buildPeerConnection, teardown, onHangUp],
  );

  const toggleMute = useCallback(() => {
    activeStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((m) => !m);
  }, []);

  const toggleCamera = useCallback(() => {
    activeStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsCameraOff((off) => !off);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  return {
    phase,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    callDuration,
    toggleMute,
    toggleCamera,
    hangUp,
    initiatePeerConnection,
    acceptPeerConnection,
    reset,
  };
}
