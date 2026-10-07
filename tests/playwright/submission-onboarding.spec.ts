import { expect, test } from "@playwright/test";

test.describe("submission-first onboarding", () => {
  test("offers a guest-first start and a bounded resume path", async ({ page }) => {
    await page.goto("/start");
    await expect(page.getByRole("heading", { name: "Start your project" })).toBeVisible();
    await expect(page.getByLabel("Team name *")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create project" })).toBeVisible();
    await expect(page.getByText(/Better Auth|Viby authentication/i)).toHaveCount(0);

    await page.getByRole("link", { name: "Resume a project" }).click();
    await expect(page).toHaveURL(/\/start\/resume$/);
    await expect(page.getByRole("heading", { name: "Resume a project" })).toBeVisible();
    await expect(page.getByLabel("Project ID")).toBeVisible();
    await expect(page.getByLabel("Edit token")).toBeVisible();
  });

  test("keeps the old public entry as a compatibility redirect", async ({ page }) => {
    await page.goto("/submit");
    await expect(page).toHaveURL(/\/start$/);
    await expect(page.getByRole("heading", { name: "Start your project" })).toBeVisible();
  });
});
