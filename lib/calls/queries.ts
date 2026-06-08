import type { SupabaseClient } from "@supabase/supabase-js";

import type { CallRow, CallStatus, CallType } from "@/types/calls";

const CALL_COLS =
  "id, conversation_id, caller_id, callee_id, type, status, started_at, answered_at, ended_at, created_at";

export async function createCall(
  supabase: SupabaseClient,
  input: {
    id: string;
    conversationId: string;
    callerId: string;
    calleeId: string;
    type: CallType;
  },
): Promise<CallRow | null> {
  const { data, error } = await supabase
    .from("calls")
    .insert({
      id: input.id,
      conversation_id: input.conversationId,
      caller_id: input.callerId,
      callee_id: input.calleeId,
      type: input.type,
      status: "ringing",
    })
    .select(CALL_COLS)
    .single();

  if (error || !data) return null;
  return data as CallRow;
}

export async function updateCallStatus(
  supabase: SupabaseClient,
  input: {
    callId: string;
    status: CallStatus;
  },
): Promise<void> {
  const patch: Record<string, unknown> = { status: input.status };
  if (input.status === "active") patch.answered_at = new Date().toISOString();
  if (input.status === "ended" || input.status === "missed" || input.status === "declined") {
    patch.ended_at = new Date().toISOString();
  }

  await supabase.from("calls").update(patch).eq("id", input.callId);
}

export async function getCall(
  supabase: SupabaseClient,
  callId: string,
): Promise<CallRow | null> {
  const { data, error } = await supabase
    .from("calls")
    .select(CALL_COLS)
    .eq("id", callId)
    .maybeSingle();

  if (error || !data) return null;
  return data as CallRow;
}
