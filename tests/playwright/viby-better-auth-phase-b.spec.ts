import { createServer, type Server } from "node:http";
import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";

const mockPort = 3211;
const assertionId = "123e4567-e89b-42d3-a456-426614174000";
let mockViby: Server;
let callbackUrl = "";
let redeemed = false;
let mockSubject = "phase-b-subject";
let vibyStartRequests = 0;

async function clickAdminNavigation(page: import("@playwright/test").Page) {
  const desktopLink = page.getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Admin" });
  if (await desktopLink.isVisible()) {
    await desktopLink.click();
    return;
  }

  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Admin" }).click();
}

async function clickGlobalLogout(
  page: import("@playwright/test").Page,
  projectName: string,
) {
  if (projectName === "mobile-chromium") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByTestId("mobile-authenticated-account-control")
      .getByRole("button", { name: "Log out" }).click();
    return;
  }
  const account = page.getByTestId("authenticated-account-control");
  const logout = account.getByRole("menuitem", { name: "Log out" });
  if (!await logout.isVisible()) {
    await account.getByRole("button", { name: /Open account menu/ }).click();
  }
  await logout.click();
}

test.beforeAll(async () => {
  redeemed = false;
  callbackUrl = "";
  const path = process.env.PLAYWRIGHT_DB_FILE;
  if (!path) throw new Error("PLAYWRIGHT_DB_FILE is required.");
  const db = new Database(path);
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword("link-test-password");
  db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, email_verified, created_at, updated_at)
      VALUES ('phase-b-user', 'Viby Unified Admin', 'viby-admin@example.test', 1, ?, ?)
    `).run(now, now);
    db.prepare(`
      INSERT OR IGNORE INTO admin_authorizations (id, user_id, status, grant_source, created_at, updated_at)
      VALUES ('phase-b-grant', 'phase-b-user', 'active', 'playwright', ?, ?)
    `).run(now, now);
    db.prepare(`
      INSERT OR IGNORE INTO viby_identity_links
        (id, provider_id, subject_id, role, local_user_id, application_id, status,
         link_provenance, display_name, last_verified_at, created_at, updated_at)
      VALUES ('phase-b-link', 'viby', 'phase-b-subject', 'admin', 'phase-b-user',
              'vibe-hackathon', 'active', 'operator', 'Viby Unified Admin', ?, ?, ?)
    `).run(now, now, now);
    for (const suffix of ["desktop-chromium", "mobile-chromium", "webkit"]) {
      const userId = `phase-b-link-${suffix}`;
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, email_verified, created_at, updated_at)
        VALUES (?, 'Link Target', ?, 1, ?, ?)
      `).run(userId, `${suffix}@example.test`, now, now);
      db.prepare(`
        INSERT OR IGNORE INTO accounts
          (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (?, ?, 'credential', ?, ?, ?, ?)
      `).run(`account-${suffix}`, userId, userId, passwordHash, now, now);
      db.prepare(`
        INSERT OR IGNORE INTO admin_authorizations (id, user_id, status, grant_source, created_at, updated_at)
        VALUES (?, ?, 'active', 'playwright', ?, ?)
      `).run(`grant-${suffix}`, userId, now, now);
      const legacyUserId = `phase-b-legacy-${suffix}`;
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, email_verified, created_at, updated_at)
        VALUES (?, 'Legacy Claim Target', ?, 1, ?, ?)
      `).run(legacyUserId, `legacy-${suffix}@example.test`, now, now);
      db.prepare(`
        INSERT OR IGNORE INTO accounts
          (id, account_id, provider_id, user_id, password, created_at, updated_at)
        VALUES (?, ?, 'credential', ?, ?, ?, ?)
      `).run(`legacy-account-${suffix}`, legacyUserId, legacyUserId, passwordHash, now, now);
      db.prepare(`
        INSERT OR IGNORE INTO viby_identity_links
          (id, provider_id, subject_id, role, local_user_id, application_id, status,
           link_provenance, display_name, last_verified_at, created_at, updated_at)
        VALUES (?, 'viby', ?, 'admin', NULL, 'vibe-hackathon', 'active',
                'operator', 'Legacy Viby identity', ?, ?, ?)
      `).run(`legacy-link-${suffix}`, `phase-b-legacy-subject-${suffix}`, now, now, now);
    }
  })();
  db.close();

  mockViby = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${mockPort}`);
    if (url.pathname === "/apps/vibe-hackathon/start") {
      vibyStartRequests += 1;
      callbackUrl = url.searchParams.get("callbackUrl") ?? "";
      const callback = new URL(callbackUrl);
      callback.searchParams.set("assertion_id", assertionId);
      res.writeHead(302, { location: callback.toString() });
      res.end();
      return;
    }
    if (url.pathname === "/api/identity/assertions/redeem" && req.method === "POST") {
      let raw = "";
      req.on("data", (chunk) => { raw += String(chunk); });
      req.on("end", () => {
        const body = JSON.parse(raw) as { assertion_id?: string };
        if (body.assertion_id !== assertionId || redeemed) {
          res.writeHead(redeemed ? 409 : 400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: redeemed ? "assertion_consumed" : "invalid_assertion_id" }));
          return;
        }
        redeemed = true;
        const expiresAt = Date.now() + 60_000;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          effectiveMode: "admin",
          assertion: {
            id: assertionId,
            type: "host_app_entry",
            audience: "vibe-hackathon",
            effectiveMode: "admin",
            returnTo: callbackUrl,
            expiresAt,
          },
          user: { id: mockSubject, displayName: "Viby Unified Admin" },
          identity: {
            method: "face_identify",
            confidence: 0.99,
            sessionId: "viby-session",
            verifiedAt: new Date().toISOString(),
            freshVerification: true,
            verificationKind: "fresh",
          },
          payload: {
            subject_type: "human",
            user_id: mockSubject,
            display_name: "Viby Unified Admin",
            audience: "vibe-hackathon",
            method: "face_identify",
            confidence: 0.99,
            session_id: "viby-session",
            context: { mode: "admin", forceIdentityCheck: true },
            issued_at: new Date().toISOString(),
            expires_at: new Date(expiresAt).toISOString(),
          },
        }));
      });
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => mockViby.listen(mockPort, resolve));
});

test.afterAll(async () => {
  if (!mockViby) return;
  await new Promise<void>((resolve, reject) => mockViby.close((error) => error ? reject(error) : resolve()));
});

test("linked Viby admin uses ordinary Admin navigation and global logout", async ({ page }, testInfo) => {
  vibyStartRequests = 0;
  await page.goto("/admin");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByTestId("admin-identity-card").getByText("Viby Unified Admin")).toBeVisible();
  await expect(page.getByTestId("admin-identity-card").getByText("Confirmed with Viby · Better Auth session")).toBeVisible();
  await expect(page.getByText("Signed in with email and password")).toHaveCount(0);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name.includes("better-auth.session_token"))).toBe(true);
  expect(cookies.some((cookie) => cookie.name === "vibe_admin_session")).toBe(false);
  expect(vibyStartRequests).toBe(1);

  await expect(page.getByTestId("admin-identity-card").getByRole("button", { name: "Log out" })).toHaveCount(0);
  await page.goto("/projects");
  await clickAdminNavigation(page);
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  expect(vibyStartRequests).toBe(1);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  expect(vibyStartRequests).toBe(1);

  await page.goto("/admin/agent-attribution-demo");
  await expect(page).toHaveURL(/\/admin\/agent-attribution-demo/);
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open menu" }).click();
    const mobileAccount = page.getByTestId("mobile-authenticated-account-control");
    await expect(mobileAccount.getByText("Viby Unified Admin")).toBeVisible();
    await expect(mobileAccount.getByRole("button", { name: "Log out" })).toBeVisible();
    await expect(mobileAccount.getByText("Confirmed with Viby · Better Auth session")).toHaveCount(0);
  } else {
    const desktopAccount = page.getByTestId("authenticated-account-control");
    await expect(desktopAccount.getByText("Viby Unified Admin")).toBeVisible();
    await desktopAccount.getByRole("button", { name: /Open account menu/ }).click();
    await expect(desktopAccount.getByRole("menuitem", { name: "Log out" })).toBeVisible();
    await expect(desktopAccount.getByText("Confirmed with Viby · Better Auth session")).toHaveCount(0);
  }
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Close menu" }).click();
  }
  await clickGlobalLogout(page, testInfo.project.name);
  await expect(page).toHaveURL(/signed_out=1/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/login\?returnTo=\/admin\/dashboard/);
  await expect(page.getByRole("button", { name: "Continue with Viby" })).toBeVisible();
});

test("consumed callback cannot be replayed", async ({ page }, testInfo) => {
  mockSubject = "phase-b-subject";
  redeemed = false;
  callbackUrl = "";
  await page.goto("/admin");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  const consumedCallbackUrl = callbackUrl;
  expect(consumedCallbackUrl).not.toBe("");
  await clickGlobalLogout(page, testInfo.project.name);
  await page.goto(consumedCallbackUrl);
  await expect(page).toHaveURL(/reason=invalid_callback_state/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/login\?returnTo=\/admin\/dashboard/);
});

test("password admin uses the same dashboard navigation without a Viby request", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  vibyStartRequests = 0;
  await page.goto("/admin");
  await page.getByLabel("Email").fill(`${suffix}@example.test`);
  await page.getByLabel("Password").fill("link-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByTestId("admin-identity-card").getByText("Signed in with Better Auth")).toBeVisible();

  await page.goto("/projects");
  await clickAdminNavigation(page);
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  expect(vibyStartRequests).toBe(0);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  expect(vibyStartRequests).toBe(0);

  await clickGlobalLogout(page, testInfo.project.name);
  await expect(page).toHaveURL(/signed_out=1/);
});

test("unlinked fresh Viby identity requires Better Auth authentication and explicit confirmation", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  mockSubject = `phase-b-unlinked-${suffix}`;
  redeemed = false;
  callbackUrl = "";
  await page.goto("/admin");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await expect(page).toHaveURL(/\/login\/link-viby/);
  await page.getByLabel("Email").fill(`${suffix}@example.test`);
  await page.getByLabel("Password").fill("link-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Link Viby identity" })).toBeVisible();
  await expect(page.getByText(`${suffix}@example.test`)).toBeVisible();
  await expect(page.getByText(/grants no administrator or judge access/i)).toBeVisible();
  await page.getByRole("button", { name: "Link account" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByTestId("admin-identity-card").getByText("Link Target")).toBeVisible();
});

test("unbound legacy identity is claimed explicitly without granting authorization", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  const path = process.env.PLAYWRIGHT_DB_FILE!;
  const legacySubject = `phase-b-legacy-subject-${suffix}`;
  const legacyUserId = `phase-b-legacy-${suffix}`;
  mockSubject = legacySubject;
  redeemed = false;
  callbackUrl = "";

  await page.goto("/admin");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await expect(page).toHaveURL(/\/login\/link-viby/);
  await page.getByLabel("Email").fill(`legacy-${suffix}@example.test`);
  await page.getByLabel("Password").fill("link-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Link Viby identity" })).toBeVisible();
  await expect(page.getByText(/grants no administrator or judge access/i)).toBeVisible();

  let db = new Database(path, { readonly: true });
  expect(db.prepare("SELECT local_user_id FROM viby_identity_links WHERE id=?").get(`legacy-link-${suffix}`))
    .toEqual({ local_user_id: null });
  db.close();

  await page.getByRole("button", { name: "Link account" }).click();
  await expect(page).toHaveURL(/reason=not_authorized/);
  db = new Database(path);
  expect(db.prepare("SELECT local_user_id,link_provenance,binding_provenance FROM viby_identity_links WHERE id=?")
    .get(`legacy-link-${suffix}`)).toEqual({
      local_user_id: legacyUserId,
      link_provenance: "operator",
      binding_provenance: "interactive_legacy_claim",
    });
  expect(db.prepare("SELECT count(*) count FROM admin_authorizations WHERE user_id=?").get(legacyUserId))
    .toEqual({ count: 0 });
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO admin_authorizations
      (id,user_id,status,grant_source,created_at,updated_at)
    VALUES (?,?,'active','playwright',?,?)
  `).run(`legacy-grant-${suffix}`, legacyUserId, now, now);
  db.close();
  await page.goto("/admin/dashboard");
  await expect(page.getByTestId("admin-identity-card").getByText("Legacy Claim Target")).toBeVisible();

  await clickGlobalLogout(page, testInfo.project.name);
  mockSubject = legacySubject;
  redeemed = false;
  callbackUrl = "";
  await page.goto("/admin");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByRole("heading", { name: "Connect existing Viby identity" })).toHaveCount(0);
});

test("interactive linking cancellation creates no link and cannot be replayed", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  const subject = `phase-b-cancel-${suffix}`;
  mockSubject = subject;
  redeemed = false;
  callbackUrl = "";
  await page.goto("/admin");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await page.getByLabel("Email").fill(`${suffix}@example.test`);
  await page.getByLabel("Password").fill("link-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Link Viby identity" })).toBeVisible();
  const pendingLinkUrl = page.url();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  const db = new Database(process.env.PLAYWRIGHT_DB_FILE!, { readonly: true });
  expect(db.prepare("SELECT count(*) count FROM viby_identity_links WHERE subject_id=?").get(subject))
    .toEqual({ count: 0 });
  expect(db.prepare(`
    SELECT status FROM viby_identity_link_transactions
    WHERE viby_subject=? ORDER BY created_at DESC LIMIT 1
  `).get(subject)).toEqual({ status: "cancelled" });
  db.close();
  await page.goto(pendingLinkUrl);
  await expect(page.getByRole("heading", { name: "Link request unavailable" })).toBeVisible();
});
