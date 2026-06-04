import { createHmac, timingSafeEqual } from "crypto";

export function verifyWebhookSecret(
  provided: string | null,
  expected: string | null,
): boolean {
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(provided, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

/** Default: reject webhooks older than 5 minutes (replay protection). */
const DEFAULT_STREAM_WEBHOOK_MAX_AGE_SEC = 300;

/**
 * Verifies Cloudflare Stream `Webhook-Signature` header (HMAC-SHA256).
 * @see https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
 */
export function verifyCloudflareStreamWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | null,
  options?: { maxAgeSeconds?: number },
): boolean {
  if (!secret || !signatureHeader) return false;

  const fields: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) fields[key] = value;
  }

  const time = fields.time;
  const sig1 = fields.sig1;
  if (!time || !sig1) return false;

  const timestamp = Number.parseInt(time, 10);
  if (!Number.isFinite(timestamp)) return false;

  const maxAge = options?.maxAgeSeconds ?? DEFAULT_STREAM_WEBHOOK_MAX_AGE_SEC;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > maxAge) return false;

  const source = `${time}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(source).digest("hex");

  if (sig1.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(sig1, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

export function verifyStreamWebhookRequest(input: {
  rawBody: string;
  secret: string | null;
  customSecretHeader: string | null;
  cloudflareSignatureHeader: string | null;
}): boolean {
  const { rawBody, secret, customSecretHeader, cloudflareSignatureHeader } =
    input;

  if (!secret) return false;

  if (customSecretHeader && verifyWebhookSecret(customSecretHeader, secret)) {
    return true;
  }

  if (
    cloudflareSignatureHeader &&
    verifyCloudflareStreamWebhookSignature(
      rawBody,
      cloudflareSignatureHeader,
      secret,
    )
  ) {
    return true;
  }

  return false;
}
