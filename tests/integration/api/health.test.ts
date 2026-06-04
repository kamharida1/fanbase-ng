import { describe, expect, it } from "vitest";

import { GET as healthGet } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns ok status", async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.service).toBe("fanbase-ng");
  });
});
