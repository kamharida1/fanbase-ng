"use server";

import { z } from "zod";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createCall, getCall, updateCallStatus } from "@/lib/calls/queries";
import { notifyMissedCall } from "@/lib/notifications/emit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CallType } from "@/types/calls";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

const startCallSchema = z.object({
  callId: z.string().uuid(),
  conversationId: z.string().uuid(),
  type: z.enum(["voice", "video"]),
});

const callIdSchema = z.object({
  callId: z.string().uuid(),
});

/**
 * Records a call attempt and returns the callee's profile so the client can
 * send the realtime invite. Does not gate on STUN/TURN reachability — that's
 * a best-effort, peer-to-peer concern handled entirely client-side.
 */
export async function startCall(
  input: unknown,
): Promise<ActionResult<{ calleeId: string }>> {
  const parsed = startCallSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid call request." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, creator_id, fan_id, status, is_blocked_by_creator, is_blocked_by_fan")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();

  if (!conversation) {
    return { success: false, error: "Conversation not found." };
  }
  if (conversation.fan_id !== auth.userId && conversation.creator_id !== auth.userId) {
    return { success: false, error: "You're not part of this conversation." };
  }
  if (conversation.status !== "accepted") {
    return { success: false, error: "You can only call within an active conversation." };
  }
  if (conversation.is_blocked_by_creator || conversation.is_blocked_by_fan) {
    return { success: false, error: "Calling is unavailable in this conversation." };
  }

  const calleeId =
    conversation.fan_id === auth.userId ? conversation.creator_id : conversation.fan_id;

  const call = await createCall(supabase, {
    id: parsed.data.callId,
    conversationId: parsed.data.conversationId,
    callerId: auth.userId,
    calleeId,
    type: parsed.data.type as CallType,
  });

  if (!call) {
    return { success: false, error: "Couldn't start the call. Try again." };
  }

  return { success: true, data: { calleeId } };
}

export async function markCallActive(input: unknown): Promise<ActionResult> {
  const parsed = callIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid call." };

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  const call = await getCall(supabase, parsed.data.callId);
  if (!call || (call.caller_id !== auth.userId && call.callee_id !== auth.userId)) {
    return { success: false, error: "Call not found." };
  }

  await updateCallStatus(supabase, { callId: call.id, status: "active" });
  return { success: true };
}

export async function endCall(input: unknown): Promise<ActionResult> {
  const parsed = callIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid call." };

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  const call = await getCall(supabase, parsed.data.callId);
  if (!call || (call.caller_id !== auth.userId && call.callee_id !== auth.userId)) {
    return { success: false, error: "Call not found." };
  }
  if (call.status === "ended" || call.status === "missed" || call.status === "declined") {
    return { success: true };
  }

  await updateCallStatus(supabase, { callId: call.id, status: "ended" });
  return { success: true };
}

export async function declineCall(input: unknown): Promise<ActionResult> {
  const parsed = callIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid call." };

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  const call = await getCall(supabase, parsed.data.callId);
  if (!call || call.callee_id !== auth.userId) {
    return { success: false, error: "Call not found." };
  }

  await updateCallStatus(supabase, { callId: call.id, status: "declined" });
  return { success: true };
}

/**
 * Caller reports that the callee never answered within the ring timeout.
 * Marks the call missed and notifies the callee (in-app + email).
 */
export async function reportMissedCall(input: unknown): Promise<ActionResult> {
  const parsed = callIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid call." };

  const supabase = await createClient();
  const auth = await requireAuth(supabase);
  const call = await getCall(supabase, parsed.data.callId);
  if (!call || call.caller_id !== auth.userId) {
    return { success: false, error: "Call not found." };
  }
  if (call.status !== "ringing") {
    return { success: true };
  }

  await updateCallStatus(supabase, { callId: call.id, status: "missed" });

  const admin = createAdminClient();
  await notifyMissedCall(admin, {
    calleeId: call.callee_id,
    callerId: call.caller_id,
    conversationId: call.conversation_id,
    callId: call.id,
    callType: call.type,
  });

  return { success: true };
}
