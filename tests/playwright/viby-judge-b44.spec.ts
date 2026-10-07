import { createServer, type Server } from "node:http";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import { expect, test } from "@playwright/test";

const mockPort = 3211;
const password = "B44-judge-link-password-123!";
let mockViby: Server;
let nextSubject = "";
let startRequests: Array<{
  callbackPath: string;
  forceIdentityCheck: boolean;
  freshIdentity: boolean;
  mode: string | null;
  source: string | null;
}> = [];
let assertionCounter = 0;
let lastCallbackRequest = "";
const assertions = new Map<string, {
  callback: string;
  subject: string;
  fresh: boolean;
  consumed: boolean;
}>();

function assertionId() {
  assertionCounter += 1;
  return `123e4567-e89b-42d3-a456-${String(assertionCounter).padStart(12, "0")}`;
}

async function seed() {
  const path = process.env.PLAYWRIGHT_DB_FILE!;
  const db = new Database(path);
  const now = Math.floor(Date.now() / 1000);
  const hash = await hashPassword(password);
  db.pragma("foreign_keys = ON");
  db.prepare(`
    INSERT INTO events (id,name,slug,is_active,is_frozen,created_at,updated_at)
    VALUES ('evt_vibe_2025','B.4.4 Event','b44-event',1,0,?,?)
    ON CONFLICT(id) DO UPDATE SET is_active=1,is_frozen=0,updated_at=excluded.updated_at
  `).run(now, now);

  for (const suffix of ["desktop-chromium", "mobile-chromium", "webkit"]) {
    for (const kind of ["returning", "link", "cancel", "unauthorized"]) {
      const userId = `b44-${kind}-${suffix}`;
      const judgeId = `b44-judge-${kind}-${suffix}`;
      db.prepare(`
        INSERT INTO users (id,name,email,email_verified,created_at,updated_at)
        VALUES (?,?,?,1,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email
      `).run(userId, `B44 ${kind}`, `${kind}-${suffix}@example.test`, now, now);
      db.prepare(`
        INSERT INTO accounts
          (id,account_id,provider_id,user_id,password,created_at,updated_at)
        VALUES (?,?, 'credential', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET password=excluded.password
      `).run(`account-${userId}`, userId, userId, hash, now, now);
      db.prepare(`
        INSERT INTO judges (id,name,email,token,created_at)
        VALUES (?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email
      `).run(judgeId, `Profile ${kind}`, `${kind}-profile-${suffix}@example.test`, `legacy-${userId}`, now);
      if (kind !== "unauthorized") {
        db.prepare(`
          INSERT INTO judge_authorizations
            (id,user_id,judge_id,event_id,status,grant_provenance,accepted_at,created_at,updated_at)
          VALUES (?,?,?,'evt_vibe_2025','active','playwright',?,?,?)
          ON CONFLICT(id) DO UPDATE SET status='active',revoked_at=NULL
        `).run(`grant-${userId}`, userId, judgeId, now, now, now);
      } else {
        db.prepare(`
          INSERT INTO admin_authorizations
            (id,user_id,status,grant_source,created_at,updated_at)
          VALUES (?,?,'active','playwright',?,?)
          ON CONFLICT(id) DO UPDATE SET status='active',revoked_at=NULL
        `).run(`admin-grant-${userId}`, userId, now, now);
      }
    }
    db.prepare(`
      INSERT INTO viby_identity_links
        (id,provider_id,subject_id,role,link_scope,local_user_id,application_id,
         status,link_provenance,environment,binding_provenance,bound_at,
         display_name,last_verified_at,last_authenticated_at,created_at,updated_at)
      VALUES (?, 'viby', ?, 'admin', 'identity', ?, 'vibe-hackathon',
              'active','interactive_fresh_verification',?,
              'interactive_fresh_verification',?,'Returning judge',?,?,?,?)
      ON CONFLICT(id) DO NOTHING
    `).run(
      `link-b44-returning-${suffix}`,
      `subject-returning-${suffix}`,
      `b44-returning-${suffix}`,
      "http://localhost:3210",
      now,
      now,
      now,
      now,
      now,
    );
  }
  db.close();
}

async function passwordSignIn(
  page: import("@playwright/test").Page,
  kind: "link" | "cancel" | "unauthorized",
  suffix: string,
) {
  await page.getByLabel("Email").fill(`${kind}-${suffix}@example.test`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function logout(
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
  await seed();
  mockViby = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${mockPort}`);
    if (url.pathname === "/apps/vibe-hackathon/start") {
      const callback = url.searchParams.get("callbackUrl") ?? "";
      const context = JSON.parse(url.searchParams.get("context") ?? "{}") as {
        forceIdentityCheck?: boolean;
        mode?: string;
        source?: string;
      };
      const callbackUrl = new URL(callback);
      if (
        callbackUrl.pathname !== "/admin/viby/callback"
        || url.searchParams.get("mode") !== "admin"
        || context.mode !== "admin"
        || context.source !== "vibe_admin_confirmation"
      ) {
        res.writeHead(400, { "content-type": "text/plain" });
        res.end("Invalid production Runtime launch contract.");
        return;
      }
      const fresh = context.forceIdentityCheck === true;
      startRequests.push({
        callbackPath: callbackUrl.pathname,
        forceIdentityCheck: fresh,
        freshIdentity: url.searchParams.get("freshIdentity") === "1",
        mode: url.searchParams.get("mode"),
        source: context.source ?? null,
      });
      const id = assertionId();
      assertions.set(id, {
        callback,
        subject: nextSubject,
        fresh,
        consumed: false,
      });
      const destination = new URL(callback);
      destination.searchParams.set("assertion_id", id);
      lastCallbackRequest = destination.toString();
      res.writeHead(302, { location: destination.toString() });
      res.end();
      return;
    }
    if (url.pathname === "/api/identity/assertions/redeem" && req.method === "POST") {
      let raw = "";
      req.on("data", (chunk) => { raw += String(chunk); });
      req.on("end", () => {
        const id = (JSON.parse(raw) as { assertion_id?: string }).assertion_id ?? "";
        const assertion = assertions.get(id);
        if (!assertion || assertion.consumed) {
          res.writeHead(assertion?.consumed ? 409 : 404).end();
          return;
        }
        assertion.consumed = true;
        const expiresAt = Date.now() + 60_000;
        const verifiedAt = assertion.fresh
          ? new Date().toISOString()
          : new Date(Date.now() - 60 * 60_000).toISOString();
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          effectiveMode: "admin",
          assertion: {
            id,
            type: "host_app_entry",
            audience: "vibe-hackathon",
            effectiveMode: "admin",
            returnTo: assertion.callback,
            expiresAt,
          },
          user: { id: assertion.subject, displayName: "B44 Viby judge" },
          identity: {
            method: assertion.fresh ? "face_identify" : "remembered_session",
            confidence: 0.99,
            sessionId: `session-${id}`,
            verifiedAt,
            freshVerification: assertion.fresh,
            verificationKind: assertion.fresh ? "fresh" : "remembered",
          },
          payload: {
            subject_type: "human",
            user_id: assertion.subject,
            display_name: "B44 Viby judge",
            audience: "vibe-hackathon",
            method: assertion.fresh ? "face_identify" : "remembered_session",
            confidence: 0.99,
            session_id: `session-${id}`,
            context: { mode: "admin", forceIdentityCheck: assertion.fresh },
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
  await new Promise<void>((resolve, reject) =>
    mockViby.close((error) => error ? reject(error) : resolve()));
});

test("returning linked judge freshly verifies into a normal Better Auth session", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  nextSubject = `subject-returning-${suffix}`;
  startRequests = [];
  await page.goto("/judge");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await expect(page).toHaveURL(/\/judge\/dashboard/);
  expect(startRequests).toEqual([{
    callbackPath: "/admin/viby/callback",
    forceIdentityCheck: true,
    freshIdentity: true,
    mode: "admin",
    source: "vibe_admin_confirmation",
  }]);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name.includes("better-auth.session_token"))).toBe(true);
  expect(cookies.some((cookie) => cookie.name === "vibe_judge_session")).toBe(false);
  await logout(page, suffix);
  await expect(page).toHaveURL(/\/\?signed_out=1/);
  const replay = lastCallbackRequest;
  expect(replay).not.toBe("");
  await page.goto(replay);
  await expect(page).toHaveURL(/reason=invalid_callback_state/);
  await page.goto("/judge/dashboard");
  await expect(page).toHaveURL(/\/login\?returnTo=\/judge\/dashboard/);
});

test("ordinary Viby sign-in replaces an unauthorized administrator session", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  await page.goto("/judge");
  await passwordSignIn(page, "unauthorized", suffix);
  await expect(page.getByText(
    /current account is not authorized for this destination/i,
  )).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Continue with Viby" }))
    .toBeVisible();
  if (process.env.VIBE_CAPTURE_UI === "true") {
    await page.screenshot({
      path: `/tmp/b45c-judge-unauthorized-${suffix}.png`,
      fullPage: true,
    });
  }
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await page.goto("/judge");

  let db = new Database(process.env.PLAYWRIGHT_DB_FILE!, { readonly: true });
  expect(db.prepare("SELECT count(*) count FROM sessions WHERE user_id=?")
    .get(`b44-unauthorized-${suffix}`)).toEqual({ count: 1 });
  db.close();

  nextSubject = `subject-returning-${suffix}`;
  startRequests = [];
  await page.getByRole("link", { name: "Use another account" }).click();
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await expect(page).toHaveURL(/\/judge\/dashboard/);
  expect(startRequests).toEqual([{
    callbackPath: "/admin/viby/callback",
    forceIdentityCheck: true,
    freshIdentity: true,
    mode: "admin",
    source: "vibe_admin_confirmation",
  }]);

  db = new Database(process.env.PLAYWRIGHT_DB_FILE!, { readonly: true });
  expect(db.prepare("SELECT count(*) count FROM sessions WHERE user_id=?")
    .get(`b44-unauthorized-${suffix}`)).toEqual({ count: 0 });
  expect(db.prepare("SELECT count(*) count FROM sessions WHERE user_id=?")
    .get(`b44-returning-${suffix}`)).toEqual({ count: 1 });
  db.close();

  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=not_authorized/);
  await page.goto("/judge/dashboard");
  await logout(page, suffix);
  await expect(page).toHaveURL(/\/\?signed_out=1/);
  await expect(page.getByTestId("authenticated-account-control")).toHaveCount(0);
  await page.goto("/judge/dashboard");
  await expect(page).toHaveURL(/\/login\?returnTo=\/judge\/dashboard/);
});

test("unlinked identity starts fresh and links only after confirmation", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  nextSubject = `subject-link-${suffix}`;
  startRequests = [];
  await page.goto("/judge");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await expect(page).toHaveURL(/\/login\/link-viby/);
  expect(startRequests.slice(-1)).toEqual([{
    callbackPath: "/admin/viby/callback",
    forceIdentityCheck: true,
    freshIdentity: true,
    mode: "admin",
    source: "vibe_admin_confirmation",
  }]);
  await passwordSignIn(page, "link", suffix);
  await expect(page.getByRole("heading", { name: "Link Viby identity" })).toBeVisible();
  await expect(page.getByText(/grants no administrator or judge access/i)).toBeVisible();

  let db = new Database(process.env.PLAYWRIGHT_DB_FILE!, { readonly: true });
  expect(db.prepare("SELECT count(*) count FROM viby_identity_links WHERE subject_id=?")
    .get(nextSubject)).toEqual({ count: 0 });
  db.close();

  await page.getByRole("button", { name: "Link account" }).click();
  await expect(page).toHaveURL(/\/judge\/dashboard/);
  db = new Database(process.env.PLAYWRIGHT_DB_FILE!, { readonly: true });
  expect(db.prepare(`
    SELECT local_user_id,link_scope FROM viby_identity_links WHERE subject_id=?
  `).get(nextSubject)).toEqual({
    local_user_id: `b44-link-${suffix}`,
    link_scope: "identity",
  });
  expect(db.prepare("SELECT count(*) count FROM admin_authorizations WHERE user_id=?")
    .get(`b44-link-${suffix}`)).toEqual({ count: 0 });
  expect(db.prepare(`
    SELECT operation,status FROM viby_identity_link_transactions
    WHERE viby_subject=? ORDER BY created_at DESC LIMIT 1
  `).get(nextSubject)).toEqual({ operation: "application_login", status: "confirmed" });
  db.close();
});

test("judge Viby linking cancellation creates no identity link", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  nextSubject = `subject-cancel-${suffix}`;
  await page.goto("/judge");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await passwordSignIn(page, "cancel", suffix);
  await expect(page.getByRole("heading", { name: "Link Viby identity" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  // Cancellation preserves the already-authenticated Better Auth session.
  // This test account has an independent live judge authorization, so /judge
  // immediately resolves to the normal dashboard.
  await expect(page).toHaveURL(/\/judge\/dashboard/);
  const db = new Database(process.env.PLAYWRIGHT_DB_FILE!, { readonly: true });
  expect(db.prepare("SELECT count(*) count FROM viby_identity_links WHERE subject_id=?")
    .get(nextSubject)).toEqual({ count: 0 });
  expect(db.prepare(`
    SELECT status FROM viby_identity_link_transactions
    WHERE viby_subject=? ORDER BY created_at DESC LIMIT 1
  `).get(nextSubject)).toEqual({ status: "cancelled" });
  db.close();
});

test("changing the Better Auth account invalidates the judge linking transaction", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name;
  nextSubject = `subject-switch-${suffix}`;
  await page.goto("/judge");
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await passwordSignIn(page, "link", suffix);
  await expect(page.getByRole("heading", { name: "Link Viby identity" })).toBeVisible();

  const sessionCookie = (await page.context().cookies()).find((cookie) =>
    cookie.name.includes("better-auth.session_token"));
  expect(sessionCookie).toBeDefined();
  await page.context().clearCookies({ name: sessionCookie!.name });
  await page.reload();
  await passwordSignIn(page, "unauthorized", suffix);
  await expect(page.getByRole("heading", { name: "Link request unavailable" })).toBeVisible();

  const db = new Database(process.env.PLAYWRIGHT_DB_FILE!, { readonly: true });
  expect(db.prepare("SELECT count(*) count FROM viby_identity_links WHERE subject_id=?")
    .get(nextSubject)).toEqual({ count: 0 });
  expect(db.prepare(`
    SELECT status,failure_code FROM viby_identity_link_transactions
    WHERE viby_subject=? ORDER BY created_at DESC LIMIT 1
  `).get(nextSubject)).toEqual({
    status: "failed",
    failure_code: "account_changed",
  });
  db.close();
});
