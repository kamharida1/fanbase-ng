import { test, expect } from "@playwright/test";

test.describe("Marketing pages", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Fanbase/i);
  });

  test("login page renders form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("signup page renders form", async ({ page }) => {
    await page.goto("/signup");
    await expect(
      page.getByRole("heading", { name: /sign up|create/i }),
    ).toBeVisible();
  });

  test("creators discover page loads", async ({ page }) => {
    await page.goto("/creators");
    const body = page.locator("body");
    const text = await body.innerText();
    if (text.includes("Something went wrong")) {
      test.skip(true, "Supabase not configured for E2E");
    }
    await expect(body).toContainText(/creator/i);
  });
});
