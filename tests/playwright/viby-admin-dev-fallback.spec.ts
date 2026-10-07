import { expect, test } from "@playwright/test";

test("development fallback token fills input and opens dashboard when enabled", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("link", { name: "Confirm with Viby" })).toBeVisible();
  await expect(page.getByText("Development fallback", { exact: true })).toBeVisible();
  await expect(page.getByText("Local admin token fallback")).not.toBeVisible();

  await page.getByText("Development fallback", { exact: true }).click();
  await expect(page.getByText("Local admin token fallback")).toBeVisible();
  await expect(page.getByText("This bypasses Viby and should stay disabled outside local development.")).toBeVisible();

  const tokenButton = page.getByRole("button", { name: "Use development admin token" });
  await expect(tokenButton).toBeVisible();
  await expect(page.getByText("playwright-admin-dev-fallback-secret")).toBeVisible();

  const input = page.getByPlaceholder("Admin token");
  await expect(input).toHaveValue("");
  await tokenButton.click();
  await expect(input).toHaveValue("playwright-admin-dev-fallback-secret");

  const devLoginRequest = page.waitForRequest((request) =>
    request.method() === "POST" && request.url() === `${page.url().replace(/\/admin(?:\?.*)?$/, "")}/admin/dev-login`
  );
  await page.getByRole("button", { name: "Enter with development fallback" }).click();
  await devLoginRequest;
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByText("Admin identity")).toBeVisible();
  await expect(page.getByText("Development Admin")).toBeVisible();
  await expect(page.getByText("Development fallback")).toBeVisible();
});
