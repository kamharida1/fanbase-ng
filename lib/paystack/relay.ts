import { logger } from "@/lib/logger";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Forwards a verified Paystack webhook payload to PrepNG so both apps work on
 * one Paystack business account. Set PREPNG_PAYSTACK_WEBHOOK_URL on Vercel, e.g.
 * https://prepng.com/api/paystack/webhook
 */
export async function forwardPaystackWebhookToPrepNG(
  rawBody: string,
  signatureHeader: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const url = process.env.PREPNG_PAYSTACK_WEBHOOK_URL?.trim();
  if (!url) {
    return { ok: false, reason: "PREPNG_PAYSTACK_WEBHOOK_URL not configured" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signatureHeader ? { "x-paystack-signature": signatureHeader } : {}),
        "x-forwarded-by": "fanbaseng",
      },
      body: rawBody,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn("paystack.webhook.prepng_forward_failed", {
        status: response.status,
        body: text.slice(0, 200),
      });
      return {
        ok: false,
        reason: `PrepNG returned ${response.status}`,
      };
    }

    logger.info("paystack.webhook.prepng_forwarded");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Forward failed";
    logger.warn("paystack.webhook.prepng_forward_error", { message });
    return { ok: false, reason: message };
  }
}

export function shouldForwardToPrepNG(): boolean {
  return Boolean(process.env.PREPNG_PAYSTACK_WEBHOOK_URL?.trim());
}
