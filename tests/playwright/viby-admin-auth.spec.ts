import { createServer, type Server, type ServerResponse } from "http";
import { expect, test, type Browser } from "@playwright/test";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import { encodeAdminSession, type AdminSession } from "../../lib/admin-session";

const mockPort = 3201;
let mockViby: Server;
let nextVibyResult:
  | { assertionId: string }
  | { status: "denied" | "error"; reason: string }
  | null = null;
const passwordAdmin = {
  id: "playwright-password-admin",
  email: "admin@example.test",
  password: "Playwright-admin-password-123!",
};
const unauthorizedUser = {
  id: "playwright-unauthorized-user",
  email: "member@example.test",
  password: "Playwright-member-password-123!",
};

function assertionResponse(userId: string) {
  const expiresAt = Date.now() + 60_000;
  return {
    effectiveMode: "admin",
    assertion: {
      id: `assertion_${userId}`,
      type: "host_app_entry",
      audience: "vibe-hackathon",
      effectiveMode: "admin",
      expiresAt,
    },
    user: {
      id: userId,
      displayName: userId === "allowlisted-viby-user" ? "Allowlisted Admin" : "Unlisted Person",
    },
    identity: {
      method: "face_identify",
      confidence: 0.91,
      sessionId: `session_${userId}`,
      verifiedAt: new Date().toISOString(),
      freshVerification: true,
      verificationKind: "fresh",
    },
    payload: {
      subject_type: "human",
      user_id: userId,
      display_name: userId === "allowlisted-viby-user" ? "Allowlisted Admin" : "Unlisted Person",
      method: "face_identify",
      confidence: 0.91,
      session_id: `session_${userId}`,
      audience: "vibe-hackathon",
      context: { mode: "admin" },
      issued_at: new Date().toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
    },
  };
}

function agentAssertionResponse() {
  const expiresAt = Date.now() + 60_000;
  return {
    assertion: {
      id: "agent-assertion",
      audience: "vibe-hackathon",
      expiresAt,
    },
    user: {
      id: "owner-viby-user",
      displayName: "George One",
    },
    identity: {
      method: "agent_delegation",
      confidence: 1,
      sessionId: "session_agent",
    },
    payload: {
      subject_type: "agent",
      agent_id: "agent_demo_g1",
      agent_name: "Demo Agent G1",
      agent_display_name: "Demo Agent G1",
      owner_user_id: "owner-viby-user",
      owner_display_name: "George One",
      delegation_method: "owner_registered",
      method: "agent_delegation",
      confidence: 1,
      session_id: "session_agent",
      audience: "vibe-hackathon",
      context: { mode: "agent-attribution" },
      issued_at: new Date().toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
    },
  };
}

function writeJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function newAdminContext(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext();
  const expiresAt = Date.now() + 60_000;
  const session: AdminSession = {
    viby_user_id: "allowlisted-viby-user",
    display_name: "Allowlisted Admin",
    role: "admin",
    issued_at: Date.now(),
    expires_at: expiresAt,
    identity_method: "face_identify",
    identity_confidence: 0.91,
  };
  await context.addCookies([{
    name: "vibe_admin_session",
    value: encodeAdminSession(session, "playwright-admin-session-secret"),
    url: baseURL,
    httpOnly: true,
    sameSite: "Lax",
    expires: Math.floor(expiresAt / 1000),
  }]);
  return context;
}

async function preparePasswordUsers() {
  const databaseFile = process.env.PLAYWRIGHT_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_DB_FILE is required.");
  const [adminHash, unauthorizedHash] = await Promise.all([
    hashPassword(passwordAdmin.password),
    hashPassword(unauthorizedUser.password),
  ]);
  const sqlite = new Database(databaseFile);
  try {
    const now = Math.floor(Date.now() / 1000);
    sqlite.transaction(() => {
      for (const user of [
        { ...passwordAdmin, name: "Password Administrator", hash: adminHash },
        { ...unauthorizedUser, name: "Unauthorized Member", hash: unauthorizedHash },
      ]) {
        sqlite.prepare(`
          INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
          VALUES (?, ?, ?, 1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            email_verified = 1,
            updated_at = excluded.updated_at
        `).run(user.id, user.name, user.email, now, now);
        sqlite.prepare(`
          INSERT INTO accounts
            (id, account_id, provider_id, user_id, password, created_at, updated_at)
          VALUES (?, ?, 'credential', ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            password = excluded.password,
            updated_at = excluded.updated_at
        `).run(`credential-${user.id}`, user.id, user.id, user.hash, now, now);
      }
      sqlite.prepare(`
        INSERT INTO admin_authorizations
          (id, user_id, status, grant_source, created_at, updated_at)
        VALUES (?, ?, 'active', 'playwright', ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          status = 'active',
          revoked_at = NULL,
          updated_at = excluded.updated_at
      `).run("authorization-playwright-admin", passwordAdmin.id, now, now);
      sqlite.prepare(`
        INSERT INTO viby_identity_links
          (id, provider_id, subject_id, role, local_user_id, application_id, status,
           link_provenance, display_name, last_verified_at, created_at, updated_at)
        VALUES (?, 'viby', 'allowlisted-viby-user', 'admin', ?, 'vibe-hackathon', 'active',
                'playwright', 'Allowlisted Admin', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          local_user_id = excluded.local_user_id,
          status = 'active',
          revoked_at = NULL,
          updated_at = excluded.updated_at
      `).run("playwright-allowlisted-viby-link", passwordAdmin.id, now, now, now);
      sqlite.prepare("DELETE FROM admin_authorizations WHERE user_id = ?")
        .run(unauthorizedUser.id);
      sqlite.prepare("DELETE FROM sessions WHERE user_id IN (?, ?)")
        .run(passwordAdmin.id, unauthorizedUser.id);
    })();
  } finally {
    sqlite.close();
  }
}

async function launchViby(
  page: import("@playwright/test").Page,
  flow: "admin" | "agent",
  result: typeof nextVibyResult,
) {
  nextVibyResult = result;
  if (flow === "admin") {
    await page.goto("/admin");
    await page.getByRole("button", { name: "Continue with Viby" }).click();
  } else {
    await page.goto(`/api/viby/start?flow=${flow}`);
  }
}

test.beforeAll(async () => {
  await preparePasswordUsers();
  mockViby = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${mockPort}`);
    const assertionId = url.pathname.split("/").pop();

    if (url.pathname === "/apps/vibe-hackathon/start") {
      const callbackUrl = url.searchParams.get("callbackUrl");
      if (!callbackUrl) {
        writeJson(res, 400, { error: "callbackUrl required" });
        return;
      }
      const callback = new URL(callbackUrl);
      const result = nextVibyResult ?? { assertionId: "valid-allowlisted" };
      nextVibyResult = null;
      if ("assertionId" in result) {
        callback.searchParams.set("assertionId", result.assertionId);
      } else {
        callback.searchParams.set("viby_status", result.status);
        callback.searchParams.set("reason", result.reason);
      }
      res.writeHead(302, { location: callback.toString() });
      res.end();
      return;
    }

    if (url.pathname.startsWith("/api/identity/assertions/") && assertionId === "valid-allowlisted") {
      writeJson(res, 200, assertionResponse("allowlisted-viby-user"));
      return;
    }
    if (url.pathname.startsWith("/api/identity/assertions/") && assertionId === "valid-unlisted") {
      writeJson(res, 200, assertionResponse("unlisted-viby-user"));
      return;
    }
    if (url.pathname.startsWith("/api/identity/assertions/") && assertionId === "valid-agent") {
      writeJson(res, 200, agentAssertionResponse());
      return;
    }
    if (url.pathname.startsWith("/api/identity/assertions/") && assertionId === "human-agent-mode") {
      const body = assertionResponse("allowlisted-viby-user");
      body.payload.context = { mode: "agent-attribution" };
      writeJson(res, 200, body);
      return;
    }
    if (url.pathname.startsWith("/api/identity/assertions/") && assertionId === "agent-wrong-mode") {
      const body = agentAssertionResponse();
      body.payload.context = { mode: "admin" };
      writeJson(res, 200, body);
      return;
    }
    if (url.pathname.startsWith("/api/identity/assertions/") && (assertionId === "wrong-audience" || assertionId === "mock-host")) {
      const body = assertionResponse("allowlisted-viby-user");
      body.assertion.audience = "mock-host";
      body.payload.audience = "mock-host";
      writeJson(res, 200, body);
      return;
    }
    if (url.pathname.startsWith("/api/identity/assertions/") && assertionId === "expired") {
      writeJson(res, 410, { error: "expired" });
      return;
    }
    writeJson(res, 404, { error: "not_found" });
  });

  await new Promise<void>((resolve) => mockViby.listen(mockPort, resolve));
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    mockViby.close((error) => error ? reject(error) : resolve());
  });
});

test("admin dashboard requires session", async ({ page }) => {
  await page.goto("/admin/dashboard");

  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
  await expect(page.getByText("Admin session required")).toBeVisible();
});

test("admin Viby confirmation button requests vibe-hackathon audience", async ({ page }) => {
  await page.goto("/admin");

  const confirmButton = page.getByRole("button", { name: "Continue with Viby" });
  await expect(confirmButton).toBeVisible();
  await expect(page.getByText("Unable to confirm identity")).toHaveCount(0);
  await expect(confirmButton.locator("xpath=ancestor::form")).toHaveAttribute("action", "/api/viby/start");
  await expect(page.getByText("Development fallback")).toHaveCount(0);
  await expect(page.getByText("playwright-admin-dev-fallback-secret")).toHaveCount(0);

  const launchRequest = page.waitForRequest((request) =>
    request.url().startsWith(`http://localhost:${mockPort}/apps/vibe-hackathon/start`),
  );
  await confirmButton.click();
  const launchUrl = new URL((await launchRequest).url());
  expect(launchUrl.searchParams.get("mode")).toBe("admin");
  expect(launchUrl.searchParams.get("freshIdentity")).toBe("1");
  expect(launchUrl.searchParams.get("callbackUrl")).toContain("/admin/viby/callback");
  expect(launchUrl.searchParams.get("context")).toContain("vibe_admin_confirmation");
});

test("unknown password user is rejected without a session", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Continue with Viby" })).toBeVisible();
  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password");
  await expect(email).toHaveAttribute("autocomplete", "username");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await email.fill("unknown@example.test");
  await password.fill("Not-the-right-password-123!");
  const authentication = page.waitForResponse((response) =>
    response.url().endsWith("/api/application-sign-in/password"),
  );
  await password.press("Enter");
  expect((await authentication).status()).toBe(401);
  await expect(page.locator("p[role='alert']")).toHaveText(
    "Unable to sign in with those credentials.",
  );
  expect((await page.context().cookies()).some((cookie) =>
    cookie.name.includes("better-auth.session_token"),
  )).toBe(false);
  const failedUrl = new URL(page.url());
  expect(failedUrl.searchParams.has("email")).toBe(false);
  expect(failedUrl.searchParams.has("password")).toBe(false);
  expect(page.url()).not.toContain("unknown@example.test");
  expect(page.url()).not.toContain("Not-the-right-password-123!");
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
});

test("wrong password is rejected without a session", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(passwordAdmin.email);
  await page.getByLabel("Password").fill("Wrong-admin-password-123!");
  const authentication = page.waitForResponse((response) =>
    response.url().endsWith("/api/application-sign-in/password"),
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await authentication).status()).toBe(401);
  await expect(page.locator("p[role='alert']")).toHaveText(
    "Unable to sign in with those credentials.",
  );
  const failedUrl = new URL(page.url());
  expect(failedUrl.searchParams.has("email")).toBe(false);
  expect(failedUrl.searchParams.has("password")).toBe(false);
  expect(page.url()).not.toContain(passwordAdmin.email);
  expect(page.url()).not.toContain("Wrong-admin-password-123!");
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
});

test("native form fallback posts credentials without putting them in the URL", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    await page.goto("/admin");
    await page.getByLabel("Email").fill(passwordAdmin.email);
    await page.getByLabel("Password").fill("Wrong-admin-password-123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login\?/);
    await expect(page.getByRole("alert")).toHaveText("Unable to sign in with those credentials.");
    const failedUrl = new URL(page.url());
    expect(failedUrl.searchParams.has("email")).toBe(false);
    expect(failedUrl.searchParams.has("password")).toBe(false);
    expect(page.url()).not.toContain(passwordAdmin.email);
    expect(page.url()).not.toContain("Wrong-admin-password-123!");
  } finally {
    await context.close();
  }
});

test("valid password admin signs in, reaches the dashboard, and logs out", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(passwordAdmin.email);
  await page.getByLabel("Password").fill(passwordAdmin.password);
  const authentication = page.waitForResponse((response) =>
    response.url().endsWith("/api/application-sign-in/password"),
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await authentication).status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByText("Admin identity")).toBeVisible();
  await expect(page.getByTestId("admin-identity-card").getByText("Password Administrator")).toBeVisible();
  await expect(page.getByTestId("admin-identity-card").getByText("Signed in with Better Auth")).toBeVisible();
  await expect(page.getByText("Signed in with email and password")).toHaveCount(0);
  expect((await page.context().cookies()).some((cookie) =>
    cookie.name.includes("better-auth.session_token"),
  )).toBe(true);

  await page.getByRole("button", { name: /Open account menu/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/\?signed_out=1/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
});

test("successful password account switch replaces the old session while failure preserves it", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(unauthorizedUser.email);
  await page.getByLabel("Password").fill(unauthorizedUser.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\?reason=not_authorized/);

  const databaseFile = process.env.PLAYWRIGHT_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_DB_FILE is required.");
  const sessionCount = (userId: string) => {
    const sqlite = new Database(databaseFile, { readonly: true });
    try {
      return (sqlite.prepare("SELECT count(*) count FROM sessions WHERE user_id = ?")
        .get(userId) as { count: number }).count;
    } finally {
      sqlite.close();
    }
  };
  expect(sessionCount(unauthorizedUser.id)).toBe(1);

  await page.getByLabel("Email").fill(passwordAdmin.email);
  await page.getByLabel("Password").fill("Wrong-admin-password-123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p[role='alert']")).toHaveText(
    "Unable to sign in with those credentials.",
  );
  expect(sessionCount(unauthorizedUser.id)).toBe(1);

  await page.getByLabel("Password").fill(passwordAdmin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  expect(sessionCount(unauthorizedUser.id)).toBe(0);
  expect(sessionCount(passwordAdmin.id)).toBe(1);
});

test("authenticated user without an admin grant is denied", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(unauthorizedUser.email);
  await page.getByLabel("Password").fill(unauthorizedUser.password);
  const authentication = page.waitForResponse((response) =>
    response.url().endsWith("/api/application-sign-in/password"),
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await authentication).status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\?reason=not_authorized/);
  await expect(page.getByText("The current account does not have administrator access", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear sessions" })).toHaveCount(0);
  if (process.env.VIBE_CAPTURE_UI === "true") {
    await page.screenshot({ path: "/tmp/b45c-admin-unauthorized-desktop.png", fullPage: true });
  }

  const databaseFile = process.env.PLAYWRIGHT_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_DB_FILE is required.");
  let sqlite = new Database(databaseFile, { readonly: true });
  expect(sqlite.prepare("SELECT count(*) count FROM sessions WHERE user_id = ?")
    .get(unauthorizedUser.id)).toEqual({ count: 1 });
  sqlite.close();

  nextVibyResult = { assertionId: "valid-allowlisted" };
  await page.getByRole("button", { name: "Continue with Viby" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByTestId("admin-identity-card").getByText("Allowlisted Admin")).toBeVisible();

  sqlite = new Database(databaseFile, { readonly: true });
  expect(sqlite.prepare("SELECT count(*) count FROM sessions WHERE user_id = ?")
    .get(unauthorizedUser.id)).toEqual({ count: 0 });
  sqlite.close();
});

test("expired Better Auth session no longer grants dashboard access", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(passwordAdmin.email);
  await page.getByLabel("Password").fill(passwordAdmin.password);
  const authentication = page.waitForResponse((response) =>
    response.url().endsWith("/api/application-sign-in/password"),
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await authentication).status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/dashboard/);

  const databaseFile = process.env.PLAYWRIGHT_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_DB_FILE is required.");
  const sqlite = new Database(databaseFile);
  try {
    sqlite.prepare("UPDATE sessions SET expires_at = 0 WHERE user_id = ?")
      .run(passwordAdmin.id);
  } finally {
    sqlite.close();
  }

  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
});

test("network failure is reported as unavailable, not bad credentials", async ({ page }) => {
  await page.route("**/api/application-sign-in/password", (route) => route.abort("failed"));
  await page.goto("/admin");
  await page.getByLabel("Email").fill(passwordAdmin.email);
  await page.getByLabel("Password").fill(passwordAdmin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p[role='alert']")).toHaveText(
    "Sign-in is temporarily unavailable.",
  );
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
});

test("untrusted origin is rejected rather than treated as bad credentials", async ({ request, baseURL }) => {
  const response = await request.post(`${baseURL}/api/auth/sign-in/email`, {
    headers: { origin: "https://untrusted.example.test" },
    data: { email: passwordAdmin.email, password: "Wrong-admin-password-123!" },
  });
  expect(response.status()).toBe(403);
});

test("dual-login form remains usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Continue with Viby" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("admin is reachable and active in desktop and mobile navigation", async ({ page }) => {
  await page.goto("/");

  const desktopNav = page.getByRole("navigation", { name: "Primary navigation" });
  const desktopAdmin = desktopNav.getByRole("link", { name: "Admin" });
  await expect(desktopAdmin).toBeVisible();
  await desktopAdmin.click();
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
  await expect(desktopNav.getByRole("link", { name: "Admin" })).toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  const mobileAdmin = mobileNav.getByRole("link", { name: "Admin" });
  await expect(mobileAdmin).toBeVisible();
  await mobileAdmin.click();
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Admin" })).toHaveAttribute("aria-current", "page");
});

test("same-tab automatic Viby callback flow creates admin session", async ({ page }) => {
  await page.goto("/admin");

  const confirmButton = page.getByRole("button", { name: "Continue with Viby" });
  await expect(confirmButton.locator("xpath=ancestor::form")).toHaveAttribute("action", "/api/viby/start");
  await confirmButton.click();

  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByText("Admin identity")).toBeVisible();
  await expect(page.getByTestId("admin-identity-card").getByText("Allowlisted Admin")).toBeVisible();
  await expect(page.getByTestId("admin-identity-card").getByText("Confirmed with Viby · Legacy application session")).toBeVisible();
});

test("automatic Viby callback flow denies non-allowlisted users", async ({ page }) => {
  await launchViby(page, "admin", { assertionId: "valid-unlisted" });

  await expect(page).toHaveURL(/viby_status=denied/);
  await expect(page.getByText("This account does not have administrator access", { exact: true })).toBeVisible();
});

test("Viby deny and error callback statuses show friendly admin messages", async ({ page }) => {
  await launchViby(page, "admin", { status: "denied", reason: "user_denied" });
  await expect(page).toHaveURL(/viby_status=denied/);
  await expect(page.getByText("Sign-in request was denied", { exact: true })).toBeVisible();
  await expect(page.getByText("Sign-in was not completed.")).toBeVisible();

  await launchViby(page, "admin", { status: "error", reason: "expired_request" });
  await expect(page).toHaveURL(/viby_status=error/);
  await expect(page.getByText("Unable to confirm identity")).toBeVisible();
  await expect(page.getByText("Viby could not complete the request. Reason: expired request.")).toBeVisible();
});

test("public pages remain public without admin session", async ({ page }) => {
  for (const path of ["/", "/projects", "/status", "/presentation"]) {
    const response = await page.goto(path);

    expect(response?.ok(), path).toBe(true);
    await expect(page).not.toHaveURL(/session_required/);
  }
});

test("logout revokes admin access", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const expiresAt = Date.now() + 60_000;
  const session: AdminSession = {
    viby_user_id: "allowlisted-viby-user",
    display_name: "Allowlisted Admin",
    role: "admin",
    issued_at: Date.now(),
    expires_at: expiresAt,
    identity_method: "face_identify",
    identity_confidence: 0.91,
  };
  await context.addCookies([{
    name: "vibe_admin_session",
    value: encodeAdminSession(session, "playwright-admin-session-secret"),
    url: baseURL,
    httpOnly: true,
    sameSite: "Lax",
    expires: Math.floor(expiresAt / 1000),
  }]);
  const page = await context.newPage();

  await page.goto("/admin/dashboard");
  await expect(page.getByText("Admin identity")).toBeVisible();
  await expect(page.getByTestId("admin-identity-card").getByText("Allowlisted Admin")).toBeVisible();
  await page.getByRole("button", { name: /Open account menu/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/\?signed_out=1/);
  expect(page.url()).not.toContain("localhost:3202");
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);

  await context.close();
});

test("invalid assertion is denied without creating an admin session", async ({ page }) => {
  await launchViby(page, "admin", { assertionId: "invalid" });

  await expect(page).toHaveURL(/viby_status=error/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
});

test("expired and wrong-audience assertions are denied", async ({ page }) => {
  await launchViby(page, "admin", { assertionId: "expired" });
  await expect(page).toHaveURL(/viby_status=error/);

  await launchViby(page, "admin", { assertionId: "mock-host" });
  await expect(page).toHaveURL(/viby_status=error/);
  await expect(page.getByText("Viby could not complete the request. Reason: wrong audience.")).toBeVisible();

  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
});

test("non-allowlisted Viby user is denied", async ({ page }) => {
  await launchViby(page, "admin", { assertionId: "valid-unlisted" });

  await expect(page).toHaveURL(/viby_status=denied/);
  await expect(page.getByText("This account does not have administrator access", { exact: true })).toBeVisible();
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);
});

test("valid allowlisted Viby user receives admin session", async ({ page }) => {
  await launchViby(page, "admin", { assertionId: "valid-allowlisted" });

  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByText("Admin identity")).toBeVisible();
  await expect(page.getByTestId("admin-identity-card").getByText("Allowlisted Admin")).toBeVisible();
  await expect(page.getByText("Method:")).toBeVisible();
  await expect(page.getByText("Face identify")).toBeVisible();
  await expect(page.getByText("Confidence:")).toBeVisible();
  await expect(page.getByText("91%")).toBeVisible();
});

test("agent attribution callback renders agent result without creating admin session", async ({ browser, baseURL }) => {
  const context = await newAdminContext(browser, baseURL);
  const page = await context.newPage();

  await launchViby(page, "agent", { assertionId: "valid-agent" });

  await expect(page).toHaveURL(/\/admin\/agent-attribution-demo/);
  await expect(page.getByText("Agent action attributed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Agent identity" })).toBeVisible();
  await expect(page.getByText("Owned by Verified owner")).toBeVisible();
  await expect(page.getByText("Actor type: agent")).toBeVisible();
  await expect(page.getByText("Assertion: Allowed")).toBeVisible();
  await expect(page.getByText("Agent identity performed an agent attribution demo action.")).toBeVisible();

  await context.close();

  const noSession = await browser.newPage();
  await launchViby(noSession, "agent", { assertionId: "valid-agent" });
  await expect(noSession).toHaveURL(/\/admin\?reason=session_required/);
  await noSession.goto("/admin/dashboard");
  await expect(noSession).toHaveURL(/\/admin\?reason=session_required/);
});

test("agent attribution callback rejects human and wrong-mode assertions", async ({ browser, baseURL }) => {
  const context = await newAdminContext(browser, baseURL);
  const page = await context.newPage();

  await launchViby(page, "agent", { assertionId: "human-agent-mode" });
  await expect(page).toHaveURL(/viby_status=error/);
  await expect(page.getByText("Viby could not complete the request")).toBeVisible();

  await launchViby(page, "agent", { assertionId: "agent-wrong-mode" });
  await expect(page).toHaveURL(/viby_status=error/);
  await expect(page.getByText("The agent attribution assertion could not be verified. Reason: wrong context.")).toBeVisible();

  await launchViby(page, "agent", { assertionId: "mock-host" });
  await expect(page).toHaveURL(/viby_status=error/);
  await expect(page.getByText("The agent attribution assertion could not be verified. Reason: wrong audience.")).toBeVisible();

  await context.close();
});

test("tampered admin session cookie is rejected", async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const expiresAt = Date.now() + 60_000;
  const session: AdminSession = {
    viby_user_id: "allowlisted-viby-user",
    display_name: "Allowlisted Admin",
    role: "admin",
    issued_at: Date.now(),
    expires_at: expiresAt,
    identity_method: "face_identify",
    identity_confidence: 0.91,
  };
  const validCookie = encodeAdminSession(session, "playwright-admin-session-secret");
  const [payload] = validCookie.split(".");
  await context.addCookies([{
    name: "vibe_admin_session",
    value: `${payload}.tampered`,
    url: baseURL,
    httpOnly: true,
    sameSite: "Lax",
    expires: Math.floor(expiresAt / 1000),
  }]);
  const page = await context.newPage();

  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\?reason=session_required/);

  await context.close();
});
