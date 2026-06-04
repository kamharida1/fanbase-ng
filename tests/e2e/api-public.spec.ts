import { test, expect } from "@playwright/test";

test.describe("Public API", () => {
  test("creators list returns JSON", async ({ request }) => {
    const res = await request.get("/api/v1/creators?limit=5");
    if (res.status() === 429) {
      test.skip();
    }
    if (res.status() === 500) {
      test.skip(true, "Supabase not configured for E2E");
    }
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(Array.isArray(json.data)).toBe(true);
  });

  test("feed requires auth", async ({ request }) => {
    const res = await request.get("/api/v1/feed");
    expect([401, 403]).toContain(res.status());
  });
});
