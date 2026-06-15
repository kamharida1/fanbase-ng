import { afterEach, describe, expect, it, vi } from "vitest";

import {
  forwardPaystackWebhookToPrepNG,
  shouldForwardToPrepNG,
} from "@/lib/paystack/relay";

describe("forwardPaystackWebhookToPrepNG", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("skips when PREPNG_PAYSTACK_WEBHOOK_URL is unset", async () => {
    vi.stubEnv("PREPNG_PAYSTACK_WEBHOOK_URL", "");
    expect(shouldForwardToPrepNG()).toBe(false);

    const result = await forwardPaystackWebhookToPrepNG('{"event":"charge.success"}', "sig");
    expect(result).toEqual({
      ok: false,
      reason: "PREPNG_PAYSTACK_WEBHOOK_URL not configured",
    });
  });

  it("forwards raw body and signature to PrepNG", async () => {
    vi.stubEnv(
      "PREPNG_PAYSTACK_WEBHOOK_URL",
      "https://prepng.com/api/paystack/webhook",
    );
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await forwardPaystackWebhookToPrepNG(
      '{"event":"charge.success","data":{}}',
      "test-signature",
    );

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://prepng.com/api/paystack/webhook",
      expect.objectContaining({
        method: "POST",
        body: '{"event":"charge.success","data":{}}',
        headers: expect.objectContaining({
          "x-paystack-signature": "test-signature",
          "x-forwarded-by": "fanbaseng",
        }),
      }),
    );
  });
});
