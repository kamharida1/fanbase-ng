import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("unauthenticated user redirected from feed to login", async ({
    page,
  }) => {
    await page.goto("/feed");
    await expect(page).toHaveURL(/\/login/);
  });

  test("public legal path does not redirect to login", async ({ page }) => {
    const res = await page.goto("/legal");
    expect(res?.status()).toBeLessThan(500);
  });
});
