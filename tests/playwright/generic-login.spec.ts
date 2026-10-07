import { expect, test } from "@playwright/test";

test.describe("generic login entry", () => {
  test("public navigation offers one role-neutral login action", async ({ page }) => {
    await page.goto("/");
    if (test.info().project.name === "mobile-chromium") {
      await page.getByRole("button", { name: "Open menu" }).click();
    }
    await expect(page.locator('a[href="/login"]').last()).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Judge" })).toHaveCount(0);
    await page.locator('a[href="/login"]').last().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Viby" })).toBeVisible();
    await expect(page.locator("main").getByText(/administrator|judge|authorization|permissions/i)).toHaveCount(0);
  });

  test("protected entry points send anonymous users to generic login with context", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?returnTo=\/admin\/dashboard/);
    await expect(page.getByText(/administrator dashboard/i)).toBeVisible();
    await page.goto("/judge");
    await expect(page).toHaveURL(/\/login\?returnTo=\/judge\/dashboard/);
    await expect(page.getByText(/continue judging/i)).toBeVisible();
  });
});
