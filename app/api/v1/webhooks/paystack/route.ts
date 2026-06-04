import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import {
  buildPaystackEventId,
  finalizeWebhookEvent,
  reserveWebhookEvent,
} from "@/lib/paystack/idempotency";
import { dispatchPaystackWebhook } from "@/lib/paystack/webhook-handler";
import type { PaystackWebhookBody } from "@/lib/paystack/types";
import { verifyPaystackSignature } from "@/lib/paystack/verify";
import { createAdminClient } from "@/lib/supabase/admin";

function requestIdFrom(request: Request): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID()
  );
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const signature = request.headers.get("x-paystack-signature");
  const rawBody = await request.text();

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json(
      { error: "Paystack is not configured" },
      { status: 503 },
    );
  }

  if (!verifyPaystackSignature(rawBody, signature)) {
    try {
      const admin = createAdminClient();
      await writeAuditLog(admin, {
        actorType: "paystack",
        action: "paystack.webhook.signature_rejected",
        entityType: "paystack_webhook",
        requestId,
        metadata: { has_signature: Boolean(signature) },
      });
    } catch {
      // Admin client unavailable — still reject.
    }
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: PaystackWebhookBody;
  try {
    body = JSON.parse(rawBody) as PaystackWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, data } = body;
  if (!event || !data) {
    return NextResponse.json({ error: "Missing event payload" }, { status: 400 });
  }

  const eventId = buildPaystackEventId(event, data);
  const admin = createAdminClient();

  const reservation = await reserveWebhookEvent(admin, {
    eventId,
    eventType: event,
    payload: { event, data },
    requestId,
    signatureValid: true,
  });

  if (reservation === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await dispatchPaystackWebhook(admin, body, requestId);
    await finalizeWebhookEvent(admin, eventId, { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await finalizeWebhookEvent(admin, eventId, { requestId, errorMessage: message });
    console.error("[paystack webhook]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
