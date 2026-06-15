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

export type PaystackWebhookProcessResult = {
  response: NextResponse;
  rawBody: string;
  signature: string | null;
  shouldForwardToPrepNG: boolean;
};

export async function processPaystackWebhookRequest(
  request: Request,
  requestId: string,
): Promise<PaystackWebhookProcessResult> {
  const signature = request.headers.get("x-paystack-signature");
  const rawBody = await request.text();
  const forwardToPrepNG = Boolean(
    process.env.PREPNG_PAYSTACK_WEBHOOK_URL?.trim(),
  );

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return {
      response: NextResponse.json(
        { error: "Paystack is not configured" },
        { status: 503 },
      ),
      rawBody,
      signature,
      shouldForwardToPrepNG: forwardToPrepNG,
    };
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
    return {
      response: NextResponse.json({ error: "Invalid signature" }, { status: 401 }),
      rawBody,
      signature,
      shouldForwardToPrepNG: false,
    };
  }

  let body: PaystackWebhookBody;
  try {
    body = JSON.parse(rawBody) as PaystackWebhookBody;
  } catch {
    return {
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
      rawBody,
      signature,
      shouldForwardToPrepNG: false,
    };
  }

  const { event, data } = body;
  if (!event || !data) {
    return {
      response: NextResponse.json(
        { error: "Missing event payload" },
        { status: 400 },
      ),
      rawBody,
      signature,
      shouldForwardToPrepNG: false,
    };
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
    return {
      response: NextResponse.json({ received: true, duplicate: true }),
      rawBody,
      signature,
      shouldForwardToPrepNG: forwardToPrepNG,
    };
  }

  try {
    await dispatchPaystackWebhook(admin, body, requestId);
    await finalizeWebhookEvent(admin, eventId, { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await finalizeWebhookEvent(admin, eventId, { requestId, errorMessage: message });
    console.error("[paystack webhook]", message, err);
    return {
      response: NextResponse.json({ error: message }, { status: 500 }),
      rawBody,
      signature,
      shouldForwardToPrepNG: false,
    };
  }

  return {
    response: NextResponse.json({ received: true }),
    rawBody,
    signature,
    shouldForwardToPrepNG: forwardToPrepNG,
  };
}
