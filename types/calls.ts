export type CallType = "voice" | "video";

export type CallStatus = "ringing" | "active" | "ended" | "missed" | "declined";

export type CallRow = {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  type: CallType;
  status: CallStatus;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export type CallPeer = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * WebRTC signaling messages exchanged over ephemeral Supabase Realtime
 * broadcast channels. Never persisted — the `calls` table only stores
 * call history (for missed-call notifications and duration), not signaling.
 */
export type CallInviteSignal = {
  type: "invite";
  callId: string;
  callType: CallType;
  conversationId: string;
  caller: CallPeer;
};

export type CallAnswerSignal = { type: "accept"; callId: string } | { type: "decline"; callId: string };

export type CallCancelSignal = { type: "cancel"; callId: string };

export type CallSdpSignal = {
  type: "offer" | "answer";
  callId: string;
  sdp: string;
};

export type CallIceSignal = {
  type: "ice-candidate";
  callId: string;
  candidate: RTCIceCandidateInit;
};

export type CallHangupSignal = { type: "hangup"; callId: string };

export type CallSignal =
  | CallInviteSignal
  | CallAnswerSignal
  | CallCancelSignal
  | CallSdpSignal
  | CallIceSignal
  | CallHangupSignal;
