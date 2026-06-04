import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import {
  verifyCloudflareStreamWebhookSignature,
  verifyStreamWebhookRequest,
  verifyWebhookSecret,
} from "@/lib/media/crypto";

describe("verifyWebhookSecret", () => {
  it("matches equal secrets", () => {
    expect(verifyWebhookSecret("secret-value-here", "secret-value-here")).toBe(
      true,
    );
  });

  it("rejects mismatch", () => {
    expect(verifyWebhookSecret("a", "b")).toBe(false);
    expect(verifyWebhookSecret(null, "x")).toBe(false);
  });
});

describe("verifyCloudflareStreamWebhookSignature", () => {
  const secret = "85011ed3a913c6ad5f9cf6c5573cc0a7";
  const rawBody = '{"uid":"abc","status":{"state":"ready"}}';
  const time = "1700000000";

  function signatureFor(body: string, t: string) {
    const sig = createHmac("sha256", secret)
      .update(`${t}.${body}`)
      .digest("hex");
    return `time=${t},sig1=${sig}`;
  }

  it("accepts valid Cloudflare-style signature", () => {
    const header = signatureFor(rawBody, time);
    expect(
      verifyCloudflareStreamWebhookSignature(rawBody, header, secret, {
        maxAgeSeconds: 999999999,
      }),
    ).toBe(true);
  });

  it("rejects tampered body", () => {
    const header = signatureFor(rawBody, time);
    expect(
      verifyCloudflareStreamWebhookSignature(
        '{"uid":"tampered"}',
        header,
        secret,
        { maxAgeSeconds: 999999999 },
      ),
    ).toBe(false);
  });

  it("rejects expired timestamp", () => {
    const header = signatureFor(rawBody, "1");
    expect(
      verifyCloudflareStreamWebhookSignature(rawBody, header, secret, {
        maxAgeSeconds: 60,
      }),
    ).toBe(false);
  });
});

describe("verifyStreamWebhookRequest", () => {
  const secret = "shared-secret-value";
  const rawBody = "{}";

  it("accepts x-media-webhook-secret", () => {
    expect(
      verifyStreamWebhookRequest({
        rawBody,
        secret,
        customSecretHeader: secret,
        cloudflareSignatureHeader: null,
      }),
    ).toBe(true);
  });

  it("accepts Cloudflare Webhook-Signature", () => {
    const time = String(Math.floor(Date.now() / 1000));
    const sig1 = createHmac("sha256", secret)
      .update(`${time}.${rawBody}`)
      .digest("hex");
    expect(
      verifyStreamWebhookRequest({
        rawBody,
        secret,
        customSecretHeader: null,
        cloudflareSignatureHeader: `time=${time},sig1=${sig1}`,
      }),
    ).toBe(true);
  });
});
