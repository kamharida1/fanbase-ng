import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/lib/audit/log";

export function buildPaystackEventId(
  event: string,
  data: Record<string, unknown>,
): string {
  const ref = asEventKey(data.reference) ?? asEventKey(data.id);
  const sub = asEventKey(data.subscription_code);
  const refund = asEventKey(data.id) && event.startsWith("refund") ? asEventKey(data.id) : null;
  const invoice = asEventKey(data.invoice_code);

  const key = ref ?? sub ?? refund ?? invoice;
  if (key) return `${event}:${key}`;

  return `${event}:${hashPayloadSlice(data)}`;
}

function asEventKey(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function hashPayloadSlice(data: Record<string, unknown>): string {
  const raw = JSON.stringify(data);
  return raw.length > 64 ? raw.slice(0, 64) : raw;
}

// If a reservation row was created but never finalized (e.g. the function
// crashed mid-processing) longer ago than this, treat it as abandoned and
// allow the retry through rather than dropping the event forever.
const STUCK_RESERVATION_MS = 10 * 60 * 1000;

export async function reserveWebhookEvent(
  admin: SupabaseClient,
  input: {
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    requestId?: string | null;
    signatureValid?: boolean;
  },
): Promise<"new" | "duplicate"> {
  const { error } = await admin.from("paystack_webhook_events").insert({
    event_id: input.eventId,
    event_type: input.eventType,
    payload: input.payload,
    request_id: input.requestId ?? null,
    signature_valid: input.signatureValid ?? true,
  });

  if (!error) {
    await writeAuditLog(admin, {
      actorType: "paystack",
      action: "paystack.webhook.received",
      entityType: "paystack_webhook_events",
      requestId: input.requestId,
      metadata: { event_id: input.eventId, event_type: input.eventType },
    });
    return "new";
  }

  if (error.code !== "23505") throw new Error(error.message);

  // A row with this event_id already exists. Paystack retries failed
  // deliveries with the same event, so a prior attempt that errored out (or
  // crashed before finalizing) must be retried here — otherwise the unique
  // constraint would cause us to report "duplicate" forever and the event
  // would never actually be processed.
  const { data: existing } = await admin
    .from("paystack_webhook_events")
    .select("processed_at, error_message, created_at")
    .eq("event_id", input.eventId)
    .maybeSingle();

  const succeeded = Boolean(existing?.processed_at) && !existing?.error_message;
  const failed = Boolean(existing?.error_message);
  const stuck =
    !existing?.processed_at &&
    !existing?.error_message &&
    Boolean(existing?.created_at) &&
    Date.now() - new Date(existing!.created_at).getTime() > STUCK_RESERVATION_MS;

  if (!succeeded && (failed || stuck)) {
    await admin
      .from("paystack_webhook_events")
      .update({
        payload: input.payload,
        request_id: input.requestId ?? null,
        processed_at: null,
        error_message: null,
      })
      .eq("event_id", input.eventId);

    await writeAuditLog(admin, {
      actorType: "paystack",
      action: "paystack.webhook.retry",
      entityType: "paystack_webhook_events",
      requestId: input.requestId,
      metadata: { event_id: input.eventId, event_type: input.eventType },
    });

    return "new";
  }

  await writeAuditLog(admin, {
    actorType: "paystack",
    action: "paystack.webhook.duplicate",
    entityType: "paystack_webhook_events",
    requestId: input.requestId,
    metadata: { event_id: input.eventId, event_type: input.eventType },
  });
  return "duplicate";
}

export async function finalizeWebhookEvent(
  admin: SupabaseClient,
  eventId: string,
  input: { requestId?: string | null; errorMessage?: string },
): Promise<void> {
  await admin
    .from("paystack_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      error_message: input.errorMessage ?? null,
    })
    .eq("event_id", eventId);

  await writeAuditLog(admin, {
    actorType: "paystack",
    action: input.errorMessage
      ? "paystack.webhook.failed"
      : "paystack.webhook.processed",
    entityType: "paystack_webhook_events",
    requestId: input.requestId,
    metadata: { event_id: eventId, error: input.errorMessage ?? null },
  });
}
