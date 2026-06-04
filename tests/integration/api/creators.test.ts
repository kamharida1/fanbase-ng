import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/v1/creators/route";

vi.mock("@/lib/creators/queries", () => ({
  listCreators: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

describe("GET /api/v1/creators", () => {
  beforeEach(async () => {
    const { listCreators } = await import("@/lib/creators/queries");
    vi.mocked(listCreators).mockResolvedValue([
      {
        user_id: "u1",
        username: "creator1",
        display_name: "Creator",
        avatar_url: null,
        bio: null,
        is_verified: false,
        plan_count: 1,
        min_price_kobo: 1000,
      },
    ]);
  });

  it("returns creator list", async () => {
    const req = new Request("http://localhost:3000/api/v1/creators?limit=10");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].username).toBe("creator1");
  });
});
