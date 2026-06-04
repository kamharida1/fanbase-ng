import { describe, expect, it, vi } from "vitest";

import {
  buildPaystackEventId,
  finalizeWebhookEvent,
  reserveWebhookEvent,
} from "@/lib/paystack/idempotency";

vi.mock("@/lib/audit/log", () => ({
  writeAuditLog: vi.fn(),
}));

describe("reserveWebhookEvent", () => {
  it("returns new on successful insert", async () => {
    const admin = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    const result = await reserveWebhookEvent(admin as never, {
      eventId: buildPaystackEventId("charge.success", { reference: "r1" }),
      eventType: "charge.success",
      payload: { event: "charge.success", data: { reference: "r1" } },
    });
    expect(result).toBe("new");
  });

  it("returns duplicate on unique violation", async () => {
    const admin = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }),
      }),
    };
    const result = await reserveWebhookEvent(admin as never, {
      eventId: "charge.success:r1",
      eventType: "charge.success",
      payload: {},
    });
    expect(result).toBe("duplicate");
  });
});

describe("finalizeWebhookEvent", () => {
  it("updates webhook row", async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const admin = {
      from: vi.fn().mockReturnValue({ update }),
    };
    await finalizeWebhookEvent(admin as never, "evt-1", { requestId: "req" });
    expect(update).toHaveBeenCalled();
  });
});
