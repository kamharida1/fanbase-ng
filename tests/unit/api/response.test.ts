import { describe, expect, it } from "vitest";

import { apiError, apiOk } from "@/lib/api/response";

describe("api response helpers", () => {
  it("apiOk wraps data", async () => {
    const res = apiOk({ ok: true }, { requestId: "req-1" });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ ok: true });
    expect(res.headers.get("x-request-id")).toBe("req-1");
  });

  it("apiError returns error with retry-after", async () => {
    const res = apiError("Too many requests.", 429, {
      retryAfter: 30,
      requestId: "req-2",
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    const json = await res.json();
    expect(json.error).toBe("Too many requests.");
  });
});
