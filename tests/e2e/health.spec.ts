import { test, expect } from "@playwright/test";

test.describe("Health endpoints", () => {
  test("GET /api/health returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.status).toBe("ok");
  });

  test("GET /api/ready responds", async ({ request }) => {
    const res = await request.get("/api/ready");
    const json = await res.json();
    expect(json).toHaveProperty("checks");
    expect(json).toHaveProperty("status");
  });
});
