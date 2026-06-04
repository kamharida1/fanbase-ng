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

  if (error?.code === "23505") {
    await writeAuditLog(admin, {
      actorType: "paystack",
      action: "paystack.webhook.duplicate",
      entityType: "paystack_webhook_events",
      requestId: input.requestId,
      metadata: { event_id: input.eventId, event_type: input.eventType },
    });
    return "duplicate";
  }

  if (error) throw new Error(error.message);

  await writeAuditLog(admin, {
    actorType: "paystack",
    action: "paystack.webhook.received",
    entityType: "paystack_webhook_events",
    requestId: input.requestId,
    metadata: { event_id: input.eventId, event_type: input.eventType },
  });

  return "new";
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
