import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { CallSignal } from "@/types/calls";

const SIGNAL_EVENT = "signal";

/**
 * Persistent per-user channel — used to deliver incoming-call invites (and
 * cancel/decline before a call channel exists). Subscribe while the user is
 * reachable for calls (e.g. on the messages page).
 */
export function subscribeToIncomingCalls(
  supabase: SupabaseClient,
  userId: string,
  onSignal: (signal: CallSignal) => void,
): RealtimeChannel {
  return supabase
    .channel(`calls:${userId}`)
    .on("broadcast", { event: SIGNAL_EVENT }, ({ payload }) => {
      onSignal(payload as CallSignal);
    })
    .subscribe();
}

/**
 * Ephemeral per-call channel — used for the WebRTC offer/answer/ICE exchange
 * and in-call hangup signaling once both parties have joined.
 */
export function subscribeToCallChannel(
  supabase: SupabaseClient,
  callId: string,
  onSignal: (signal: CallSignal) => void,
): RealtimeChannel {
  return supabase
    .channel(`call:${callId}`)
    .on("broadcast", { event: SIGNAL_EVENT }, ({ payload }) => {
      onSignal(payload as CallSignal);
    })
    .subscribe();
}

export async function sendSignal(
  channel: RealtimeChannel,
  signal: CallSignal,
): Promise<void> {
  await channel.send({
    type: "broadcast",
    event: SIGNAL_EVENT,
    payload: signal,
  });
}

/** One-shot send to a user's persistent channel — for invites/cancel/decline. */
export async function sendSignalToUser(
  supabase: SupabaseClient,
  userId: string,
  signal: CallSignal,
): Promise<void> {
  const channel = supabase.channel(`calls:${userId}`);
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
  });
  await sendSignal(channel, signal);
  await supabase.removeChannel(channel);
}

export function unsubscribeChannel(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
): void {
  supabase.removeChannel(channel);
}
