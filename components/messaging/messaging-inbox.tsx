"use client";

import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CallOverlay } from "@/components/calls/call-overlay";
import { IncomingCallModal } from "@/components/calls/incoming-call-modal";
import { ConversationList } from "@/components/messaging/conversation-list";
import { MessageThread } from "@/components/messaging/message-thread";
import {
  declineCall,
  endCall,
  markCallActive,
  reportMissedCall,
  startCall,
} from "@/lib/calls/actions";
import {
  sendSignalToUser,
  subscribeToIncomingCalls,
  unsubscribeChannel as unsubscribeCallChannel,
} from "@/lib/calls/signaling";
import { useCall } from "@/lib/calls/use-call";
import {
  subscribeToInbox,
  unsubscribeChannel,
} from "@/lib/messaging/realtime";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { CallInviteSignal, CallPeer, CallType } from "@/types/calls";
import type { ConversationRow, MessageRow } from "@/types/messaging";

const RING_TIMEOUT_MS = 30_000;

export function MessagingInbox({
  initialInbox,
  initialRequests,
  initialMessages,
  selectedConversation,
  currentUserId,
  role,
  requestCount,
  watermarkLabel,
  callerUsername,
  callerDisplayName,
  hideRequestLimits = false,
}: {
  initialInbox: ConversationRow[];
  initialRequests: ConversationRow[];
  initialMessages: MessageRow[];
  selectedConversation: ConversationRow | null;
  currentUserId: string;
  role: "fan" | "creator";
  requestCount: number;
  watermarkLabel?: string | null;
  callerUsername: string;
  callerDisplayName?: string | null;
  hideRequestLimits?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("c");
  const [tab, setTab] = useState<"inbox" | "requests">(
    searchParams.get("tab") === "requests" ? "requests" : "inbox",
  );
  const [inbox, setInbox] = useState(initialInbox);
  const [requests, setRequests] = useState(initialRequests);

  const supabase = createClient();

  // ── Call state ────────────────────────────────────────────────────────────
  const [incomingSignal, setIncomingSignal] = useState<CallInviteSignal | null>(null);
  const [callPeer, setCallPeer] = useState<CallPeer | null>(null);
  const [activeCallType, setActiveCallType] = useState<CallType>("voice");

  const incomingSignalRef = useRef<CallInviteSignal | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const calleeIdRef = useRef<string | null>(null);
  // Tracks phase in refs so async callbacks always see current value
  const callPhaseRef = useRef<
    "idle" | "calling" | "ringing" | "connecting" | "active" | "ended"
  >("idle");
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callerProfile = useMemo<CallPeer>(
    () => ({
      id: currentUserId,
      username: callerUsername,
      display_name: callerDisplayName ?? null,
      avatar_url: null,
    }),
    [currentUserId, callerUsername, callerDisplayName],
  );

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }, []);

  const call = useCall(supabase, (callId) => {
    // Triggered by hangUp() — local or remote hangup
    clearRingTimer();
    void endCall({ callId });
    setCallPeer(null);
    calleeIdRef.current = null;
    activeCallIdRef.current = null;
  });

  // Keep a stable ref to call methods so subscription callbacks don't go stale
  const callRef = useRef(call);
  useEffect(() => {
    callRef.current = call;
  });

  // Sync phase to ref
  useEffect(() => {
    callPhaseRef.current = call.phase;
  }, [call.phase]);

  // Clear overlay when call reaches a terminal state
  useEffect(() => {
    if (call.phase === "idle" || call.phase === "ended") {
      setCallPeer(null);
    }
  }, [call.phase]);

  // ── Incoming calls subscription ───────────────────────────────────────────
  useEffect(() => {
    const channel = subscribeToIncomingCalls(supabase, currentUserId, (signal) => {
      if (signal.type === "invite") {
        incomingSignalRef.current = signal;
        setIncomingSignal(signal);
      } else if (signal.type === "cancel") {
        if (incomingSignalRef.current?.callId === signal.callId) {
          incomingSignalRef.current = null;
          setIncomingSignal(null);
        }
      } else if (signal.type === "decline") {
        // Callee declined our outgoing call via our persistent channel
        if (activeCallIdRef.current === signal.callId) {
          clearRingTimer();
          callRef.current.reset();
          setCallPeer(null);
          void endCall({ callId: signal.callId });
          calleeIdRef.current = null;
          activeCallIdRef.current = null;
        }
      }
    });
    return () => unsubscribeCallChannel(supabase, channel);
    // Only re-subscribe if userId changes; clearRingTimer is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // ── Outgoing call ─────────────────────────────────────────────────────────
  const handleStartCall = useCallback(
    async (callType: CallType) => {
      if (!selectedConversation || selectedConversation.status !== "accepted") return;
      if (callPhaseRef.current !== "idle") return;

      const peer = selectedConversation.other_participant;
      if (!peer) return;

      const callId = crypto.randomUUID();
      const result = await startCall({
        callId,
        conversationId: selectedConversation.id,
        type: callType,
      });
      if (!result.success) return;

      const calleeId = result.data!.calleeId;
      calleeIdRef.current = calleeId;
      activeCallIdRef.current = callId;
      setCallPeer(peer);
      setActiveCallType(callType);

      // Subscribe to call channel and wait for callee's "accept" before sending offer
      await callRef.current.initiatePeerConnection(callId, callType);

      // Deliver invite to callee's persistent channel
      await sendSignalToUser(supabase, calleeId, {
        type: "invite",
        callId,
        callType,
        conversationId: selectedConversation.id,
        caller: callerProfile,
      });

      // Ring timeout — mark missed and cancel if no answer
      ringTimerRef.current = setTimeout(() => {
        if (callPhaseRef.current === "calling") {
          void reportMissedCall({ callId });
          const ceeId = calleeIdRef.current;
          if (ceeId) {
            void sendSignalToUser(supabase, ceeId, { type: "cancel", callId });
          }
          callRef.current.reset();
          setCallPeer(null);
          clearRingTimer();
          calleeIdRef.current = null;
          activeCallIdRef.current = null;
        }
      }, RING_TIMEOUT_MS);
    },
    [selectedConversation, callerProfile, supabase, clearRingTimer],
  );

  // Cancel outgoing or hang up active call
  const handleHangUpOrCancel = useCallback(async () => {
    const callId = activeCallIdRef.current;
    if (!callId) return;
    clearRingTimer();

    if (callPhaseRef.current === "calling") {
      // Callee hasn't answered — cancel
      const calleeId = calleeIdRef.current;
      callRef.current.reset();
      setCallPeer(null);
      if (calleeId) {
        await sendSignalToUser(supabase, calleeId, { type: "cancel", callId });
      }
      await endCall({ callId });
      calleeIdRef.current = null;
      activeCallIdRef.current = null;
    } else {
      // Active/connecting — hangUp sends signal + triggers onHangUp which calls endCall
      callRef.current.hangUp();
    }
  }, [supabase, clearRingTimer]);

  // ── Incoming call ─────────────────────────────────────────────────────────
  const handleAcceptCall = useCallback(async () => {
    const signal = incomingSignalRef.current;
    if (!signal) return;

    setIncomingSignal(null);
    incomingSignalRef.current = null;
    activeCallIdRef.current = signal.callId;
    setCallPeer(signal.caller);
    setActiveCallType(signal.callType);

    await callRef.current.acceptPeerConnection(signal.callId, signal.callType);
    await markCallActive({ callId: signal.callId });
  }, []);

  const handleDeclineCall = useCallback(async () => {
    const signal = incomingSignalRef.current;
    if (!signal) return;

    setIncomingSignal(null);
    incomingSignalRef.current = null;

    // Notify caller via their persistent channel so they see the decline immediately
    await sendSignalToUser(supabase, signal.caller.id, {
      type: "decline",
      callId: signal.callId,
    });
    await declineCall({ callId: signal.callId });
  }, [supabase]);

  // ── Messaging inbox ───────────────────────────────────────────────────────
  const refreshInbox = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    setInbox(initialInbox);
    setRequests(initialRequests);
  }, [initialInbox, initialRequests]);

  useEffect(() => {
    const channel = subscribeToInbox(supabase, currentUserId, role, refreshInbox);
    return () => unsubscribeChannel(supabase, channel);
  }, [currentUserId, role, refreshInbox, supabase]);

  function selectConversation(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("c", id);
    if (tab === "requests") params.set("tab", "requests");
    router.push(`?${params.toString()}`);
  }

  function clearConversation() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("c");
    router.push(`?${params.toString()}`);
  }

  const list = tab === "requests" ? requests : inbox;
  const showThread = Boolean(selectedId && selectedConversation);
  const showOverlay =
    call.phase === "calling" ||
    call.phase === "ringing" ||
    call.phase === "connecting" ||
    call.phase === "active";

  return (
    <>
      {incomingSignal ? (
        <IncomingCallModal
          caller={incomingSignal.caller}
          callType={incomingSignal.callType}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      ) : null}

      {showOverlay && callPeer ? (
        <CallOverlay
          peer={callPeer}
          callType={activeCallType}
          phase={call.phase}
          localStream={call.localStream}
          remoteStream={call.remoteStream}
          isMuted={call.isMuted}
          isCameraOff={call.isCameraOff}
          callDuration={call.callDuration}
          onToggleMute={call.toggleMute}
          onToggleCamera={call.toggleCamera}
          onHangUp={handleHangUpOrCancel}
        />
      ) : null}

      <div
        className={cn(
          "grid min-h-[min(70dvh,560px)] overflow-hidden rounded-xl border",
          "h-[calc(100dvh-11rem)] max-h-[720px] md:h-[calc(100vh-12rem)] md:max-h-none",
          "md:grid-cols-[minmax(0,320px)_1fr]",
        )}
      >
        <aside
          className={cn(
            "flex min-h-0 min-w-0 flex-col border-b md:border-b-0 md:border-r",
            showThread ? "hidden md:flex" : "flex",
          )}
        >
          {role === "creator" ? (
            <div className="flex shrink-0 border-b">
              <button
                type="button"
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  tab === "inbox" ? "border-b-2 border-primary" : "text-muted-foreground"
                }`}
                onClick={() => {
                  setTab("inbox");
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("tab");
                  router.push(`?${params.toString()}`);
                }}
              >
                Inbox
              </button>
              <button
                type="button"
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  tab === "requests"
                    ? "border-b-2 border-primary"
                    : "text-muted-foreground"
                }`}
                onClick={() => {
                  setTab("requests");
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("tab", "requests");
                  router.push(`?${params.toString()}`);
                }}
              >
                Requests
                {requestCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                    {requestCount}
                  </span>
                ) : null}
              </button>
            </div>
          ) : (
            <div className="shrink-0 border-b px-4 py-3">
              <p className="text-sm font-semibold">Messages</p>
            </div>
          )}

          <ConversationList
            conversations={list}
            selectedId={selectedId}
            onSelect={selectConversation}
          />
        </aside>

        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-col bg-muted/20",
            showThread ? "flex" : "hidden md:flex",
          )}
        >
          {showThread ? (
            <>
              <button
                type="button"
                className="flex shrink-0 items-center gap-1 border-b px-4 py-2.5 text-sm font-medium md:hidden"
                onClick={clearConversation}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Conversations
              </button>
              <MessageThread
                conversation={selectedConversation!}
                initialMessages={initialMessages}
                currentUserId={currentUserId}
                role={role}
                watermarkLabel={watermarkLabel}
                onStartCall={handleStartCall}
                hideRequestLimits={hideRequestLimits}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
              <p>Select a conversation to start messaging.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
