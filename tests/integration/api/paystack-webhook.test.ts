import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/v1/webhooks/paystack/route";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/paystack/idempotency", () => ({
  buildPaystackEventId: vi.fn(() => "evt:1"),
  reserveWebhookEvent: vi.fn(),
  finalizeWebhookEvent: vi.fn(),
}));

vi.mock("@/lib/paystack/webhook-handler", () => ({
  dispatchPaystackWebhook: vi.fn(),
}));

describe("POST /api/v1/webhooks/paystack", () => {
  it("rejects missing signature", async () => {
    const req = new Request("http://localhost:3000/api/v1/webhooks/paystack", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects invalid signature", async () => {
    const req = new Request("http://localhost:3000/api/v1/webhooks/paystack", {
      method: "POST",
      headers: { "x-paystack-signature": "invalid" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
