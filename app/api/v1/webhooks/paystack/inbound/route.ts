import { NextResponse } from "next/server";

import { processPaystackWebhookRequest } from "@/lib/paystack/process-webhook-request";
import { enforceRateLimit } from "@/lib/rate-limit-http";

function requestIdFrom(request: Request): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID()
  );
}

/**
 * Relay entrypoint when Paystack still posts to PrepNG first.
 * PrepNG should forward the raw body + x-paystack-signature here.
 * This route never forwards back to PrepNG (avoids loops).
 */
export async function POST(request: Request) {
  const rl = await enforceRateLimit(request, "paystackWebhook", "webhook");
  if (rl) return rl;

  const requestId = requestIdFrom(request);
  const result = await processPaystackWebhookRequest(request, requestId);
  return result.response;
}
