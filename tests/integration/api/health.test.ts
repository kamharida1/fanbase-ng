import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  })),
}));

import { GET as healthGet } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns ok status when db is reachable", async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.service).toBe("fanbase-ng");
    expect(json.checks.database).toBe(true);
  });

  it("returns 503 when db is unreachable", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    vi.mocked(createAdminClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ error: { message: "connection refused" } }),
        })),
      })),
    } as never);

    const res = await healthGet();
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe("degraded");
    expect(json.checks.database).toBe(false);
  });
});
