import { describe, expect, it } from "vitest";

import { rateLimitToResponse } from "@/lib/rate-limit-http";

describe("rateLimitToResponse", () => {
  it("returns null when ok", () => {
    const req = new Request("http://localhost");
    expect(rateLimitToResponse(req, { ok: true })).toBeNull();
  });

  it("returns 429 when blocked", async () => {
    const req = new Request("http://localhost");
    const res = rateLimitToResponse(req, {
      ok: false,
      retryAfterSeconds: 42,
    });
    expect(res?.status).toBe(429);
    const json = await res!.json();
    expect(json.error).toContain("Too many");
  });
});
