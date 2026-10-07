import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";

const operatorPassword = "Account-management-operator-123!";
let operator: { id: string; name: string; email: string };
let createdEmail: string;
let judgeProfileId: string;
let createdTemporaryPassword = "";
let invitedEmail: string;

test.beforeAll(async ({}, workerInfo) => {
  const databaseFile = process.env.PLAYWRIGHT_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_DB_FILE is required.");
  const suffix = workerInfo.project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  operator = {
    id: `account-operator-${suffix}`,
    name: `Access Operator ${suffix}`,
    email: `account-operator-${suffix}@example.test`,
  };
  createdEmail = `managed-person-${suffix}@example.test`;
  invitedEmail = `invited-person-${suffix}@example.test`;
  judgeProfileId = `account-judge-${suffix}`;
  const password = await hashPassword(operatorPassword);
  const now = Math.floor(Date.now() / 1000);
  const sqlite = new Database(databaseFile);
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.prepare(`
      INSERT INTO events (id,name,slug,is_active,is_frozen,created_at,updated_at)
      VALUES ('evt_vibe_2025','Account Test Event','account-test',1,0,?,?)
      ON CONFLICT(id) DO UPDATE SET is_active=1,updated_at=excluded.updated_at
    `).run(now, now);
    sqlite.prepare(`
      INSERT INTO users (id,name,email,email_verified,created_at,updated_at)
      VALUES (?,?,?,1,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,updated_at=excluded.updated_at
    `).run(operator.id, operator.name, operator.email, now, now);
    sqlite.prepare(`
      INSERT INTO accounts (id,account_id,provider_id,user_id,password,created_at,updated_at)
      VALUES (?,?, 'credential',?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET password=excluded.password,updated_at=excluded.updated_at
    `).run(`credential-${operator.id}`, operator.id, operator.id, password, now, now);
    sqlite.prepare(`
      INSERT INTO admin_authorizations (id,user_id,status,grant_source,created_at,updated_at)
      VALUES (?,?,'active','playwright',?,?)
      ON CONFLICT(user_id) DO UPDATE SET status='active',revoked_at=NULL,updated_at=excluded.updated_at
    `).run(`grant-${operator.id}`, operator.id, now, now);
    sqlite.prepare(`
      INSERT INTO judges (id,token,name,email,created_at)
      VALUES (?,?,?, ?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email
    `).run(judgeProfileId, `legacy-${judgeProfileId}`, `Judge ${suffix}`, `judge-${suffix}@example.test`, now);
  })();
  sqlite.close();
});

test("invitation is the preferred one-time onboarding handoff", async ({ page }, testInfo) => {
  await signIn(page);
  const menu = await openAccountMenu(page, testInfo.project.name);
  const itemRole = testInfo.project.name === "mobile-chromium" ? "link" : "menuitem";
  await menu.getByRole(itemRole, { name: "People & Access" }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  const create = page.getByRole("dialog", { name: "Add a person" });
  await create.getByLabel("Name").fill("Invited Person");
  await create.getByLabel("Email").fill(invitedEmail);
  await expect(create.getByLabel("Create invitation link")).toBeChecked();
  await create.getByRole("button", { name: "Create", exact: true }).click();
  const handoff = page.getByRole("dialog", { name: "Invitation ready" });
  const invitationLink = (await handoff.locator("code").textContent()) ?? "";
  expect(invitationLink).toContain("/invite/");
  await handoff.getByRole("button", { name: "I saved it" }).click();
  await page.goto(invitationLink);
  await expect(page).toHaveURL(/\/invite\/accept$/);
  await page.getByRole("button", { name: "Sign out and continue" }).click();
  await expect(page.getByRole("heading", { name: "Welcome, Invited Person" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Viby" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create a password" })).toBeVisible();
  await expect(page.getByText(/Better Auth|Runtime|transaction/i)).toHaveCount(0);
  if (process.env.VIBE_CAPTURE_UI === "true") {
    await page.screenshot({
      path: `/tmp/b45b-invitation-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
});

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(operator.email);
  await page.getByLabel("Password").fill(operatorPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 12_000 })
    .toBe("/admin/dashboard");
}

async function openAccountMenu(
  page: import("@playwright/test").Page,
  projectName: string,
) {
  if (projectName === "mobile-chromium") {
    await page.getByRole("button", { name: "Open menu" }).click();
    return page.getByTestId("mobile-authenticated-account-control");
  }
  const account = page.getByTestId("authenticated-account-control");
  await account.getByRole("button", { name: /Open account menu/ }).click();
  return account;
}

test("account settings and People & Access preserve explicit authorization", async ({ page }, testInfo) => {
  await signIn(page);
  const menu = await openAccountMenu(page, testInfo.project.name);
  if (testInfo.project.name === "mobile-chromium") {
    await expect(menu.getByText(operator.name, { exact: true })).toBeVisible();
  } else {
    await expect(menu.getByRole("menu").getByText(operator.name, { exact: true })).toBeVisible();
  }
  const accountItemRole = testInfo.project.name === "mobile-chromium" ? "link" : "menuitem";
  await expect(menu.getByRole(accountItemRole, { name: "Account" })).toBeVisible();
  await expect(menu.getByRole(accountItemRole, { name: "People & Access" })).toBeVisible();
  await expect(menu.getByRole(
    testInfo.project.name === "mobile-chromium" ? "button" : "menuitem",
    { name: "Log out" },
  )).toBeVisible();
  await menu.getByRole(accountItemRole, { name: "Account" }).click();

  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Password" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent sign-ins" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Linked identity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Access" })).toBeVisible();
  await expect(page.getByText("Administrator").last()).toBeVisible();

  const accountMenu = await openAccountMenu(page, testInfo.project.name);
  await accountMenu.getByRole(accountItemRole, { name: "People & Access" }).click();
  await expect(page).toHaveURL(/\/admin\/people/);
  await expect(page.getByRole("heading", { name: "People & Access" })).toBeVisible();
  await page.getByRole("button", { name: "Create account" }).click();
  const create = page.getByRole("dialog", { name: "Add a person" });
  await expect(create.getByLabel("Create invitation link")).toBeChecked();
  await create.getByLabel("Generate temporary password").check();
  await create.getByLabel("Name").fill("Managed Person");
  await create.getByLabel("Email").fill(createdEmail);
  await create.getByRole("button", { name: "Create", exact: true }).click();

  const password = page.getByRole("dialog", { name: "Temporary password" });
  await expect(password.getByText("It will not be shown again.")).toBeVisible();
  await expect(password.locator("code")).not.toBeEmpty();
  createdTemporaryPassword = (await password.locator("code").textContent()) ?? "";
  await password.getByRole("button", { name: "I saved it" }).click();
  await expect(password).not.toBeVisible();

  await page.getByPlaceholder("Search name or email").fill(createdEmail);
  const row = page.getByRole("row").filter({ hasText: createdEmail });
  await expect(row.getByText("Password", { exact: true })).toBeVisible();
  await expect(row.getByText("No protected access")).toBeVisible();
  await row.getByRole("button", { name: "Manage" }).click();

  const sheet = page.getByRole("dialog", { name: "Managed Person" });
  const closeSheet = sheet.getByRole("button", { name: "Close person details" });
  await expect(closeSheet).toBeFocused();
  await sheet.getByLabel("Judge profile").selectOption(judgeProfileId);
  await sheet.getByRole("switch", { name: "Grant Judge access" }).click();
  await expect(sheet.getByRole("switch", { name: "Revoke Judge access" })).toHaveAttribute("aria-checked", "true");
  if (process.env.VIBE_CAPTURE_UI === "true") {
    await page.screenshot({
      path: `/tmp/b45b-people-${testInfo.project.name}.png`,
      fullPage: true,
    });
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Manage" })).toBeFocused();
  await expect(row.getByText("Judge", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Temporary password" })).toHaveCount(0);
});

test("temporary password requires a change and the replacement password works", async ({ page }, testInfo) => {
  expect(createdTemporaryPassword.length).toBeGreaterThan(16);
  await page.goto("/judge");
  await page.getByLabel("Email").fill(createdEmail);
  await page.getByLabel("Password").fill(createdTemporaryPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account\?password=required/);
  await expect(page.getByText("Choose a new password before continuing.")).toBeVisible();

  const replacement = `Replacement-${testInfo.project.name}-91!`;
  await page.getByLabel("Current password").fill(createdTemporaryPassword);
  await page.getByLabel("New password", { exact: true }).fill(replacement);
  await page.getByLabel("Confirm new password").fill(replacement);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Password changed." })).toBeVisible();

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByTestId("mobile-authenticated-account-control")
      .getByRole("button", { name: "Log out" }).click();
  } else {
    const account = page.getByTestId("authenticated-account-control");
    await account.getByRole("button", { name: /Open account menu/ }).click();
    await account.getByRole("menuitem", { name: "Log out" }).click();
  }

  await page.goto("/judge");
  await page.getByLabel("Email").fill(createdEmail);
  await page.getByLabel("Password").fill(replacement);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/judge\/dashboard/);
});
