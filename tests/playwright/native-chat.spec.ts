import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";

const ownerPassword = "C3-owner-test-password-123!";
const teammatePassword = "C3-teammate-test-password-123!";
const unrelatedPassword = "C3-unrelated-test-password-123!";
const runNonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let owner: { id: string; email: string; name: string };
let teammate: { id: string; email: string; name: string };
let unrelated: { id: string; email: string; name: string };
let submissionId: string;
let editToken: string;

test.beforeAll(async ({}, workerInfo) => {
  const databaseFile = process.env.PLAYWRIGHT_C3_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_C3_DB_FILE is required.");
  const suffix = `${workerInfo.project.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${runNonce}`;
  owner = { id: `c3-owner-${suffix}`, email: `c3-owner-${suffix}@example.test`, name: `C3 Owner ${suffix}` };
  teammate = { id: `c3-teammate-${suffix}`, email: `c3-teammate-${suffix}@example.test`, name: `C3 Teammate ${suffix}` };
  unrelated = { id: `c3-unrelated-${suffix}`, email: `c3-unrelated-${suffix}@example.test`, name: `C3 Unrelated ${suffix}` };
  submissionId = `sub_c3_${suffix}`;
  editToken = `edit_c3_${suffix}`;
  const now = Math.floor(Date.now() / 1000);
  const [ownerHash, teammateHash, unrelatedHash] = await Promise.all([
    hashPassword(ownerPassword),
    hashPassword(teammatePassword),
    hashPassword(unrelatedPassword),
  ]);
  const sqlite = new Database(databaseFile);
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.prepare(`INSERT INTO events (id,name,slug,is_active,is_frozen,created_at,updated_at) VALUES ('evt_vibe_2025','C3 Test Event',?,1,0,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,is_active=1,is_frozen=0,updated_at=excluded.updated_at`).run(`c3-test-${suffix}`, now, now);
    const user = sqlite.prepare(`INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)`);
    for (const item of [owner, teammate, unrelated]) user.run(item.id, item.name, item.email, now, now);
    const account = sqlite.prepare(`INSERT INTO accounts (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?, 'credential',?,?,?,?)`);
    account.run(`account-${owner.id}`, owner.id, owner.id, ownerHash, now, now);
    account.run(`account-${teammate.id}`, teammate.id, teammate.id, teammateHash, now, now);
    account.run(`account-${unrelated.id}`, unrelated.id, unrelated.id, unrelatedHash, now, now);
    sqlite.prepare(`INSERT INTO submissions (id,event_id,edit_token,status,team_name,contact_email,project_title,created_at) VALUES (?,?,?,'draft',?,?,?,?)`).run(submissionId, "evt_vibe_2025", editToken, "C3 Test Team", owner.email, "C3 Private Room", now);
    sqlite.prepare(`INSERT INTO submission_owners (id,submission_id,user_id,created_at) VALUES (?,?,?,?)`).run(`owner-${suffix}`, submissionId, owner.id, now);
    sqlite.prepare(`INSERT INTO team_members (id,submission_id,name,email,"order") VALUES (?,?,?,?,0)`).run(`member-owner-${suffix}`, submissionId, owner.name, owner.email);
    sqlite.prepare(`INSERT INTO team_members (id,submission_id,name,email,"order") VALUES (?,?,?,?,1)`).run(`member-teammate-${suffix}`, submissionId, teammate.name, teammate.email);
    sqlite.prepare(`INSERT INTO team_members (id,submission_id,name,email,"order") VALUES (?,?,?,?,2)`).run(`member-matching-${suffix}`, submissionId, "Roster-only unrelated", unrelated.email);
    sqlite.prepare(`INSERT INTO submission_memberships (id,submission_id,user_id,role,status,joined_at,created_at,updated_at) VALUES (?,?,?,'owner','active',?,?,?)`).run(`membership-owner-${suffix}`, submissionId, owner.id, now, now, now);
  })();
  sqlite.close();
});

test("owner and teammate can use the private room, then revocation closes access", async ({ page, browser }, testInfo) => {
  await signIn(page, owner.email, ownerPassword);
  await page.goto(`/projects/${submissionId}`);
  await expect(page.getByRole("heading", { name: "C3 Private Room" })).toBeVisible();
  await page.screenshot({ path: `docs/native-chat/screenshots/c6-${testInfo.project.name}-overview.png`, fullPage: true });
  const workspaceNav = page.getByRole("navigation", { name: "Project workspace" });
  for (const tab of ["Overview", "Team", "Messages", "Activity", "Preview", "Submission"]) {
    await expect(workspaceNav.getByRole("link", { name: tab, exact: true })).toBeVisible();
  }
  await workspaceNav.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Project activity" })).toBeVisible();
  await page.screenshot({ path: `docs/native-chat/screenshots/c6-${testInfo.project.name}-activity.png`, fullPage: true });
  await page.getByRole("navigation", { name: "Project workspace" }).getByRole("link", { name: "Team", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Formal roster" })).toBeVisible();
  await page.screenshot({ path: `docs/native-chat/screenshots/c6-${testInfo.project.name}-team.png`, fullPage: true });
  await page.goto(`/projects/${submissionId}/submission`);
  await expect(page.getByRole("heading", { name: "Submission status" })).toBeVisible();
  await page.screenshot({ path: `docs/native-chat/screenshots/c6-${testInfo.project.name}-status.png`, fullPage: true });
  await page.goto(`/account/projects`);
  await expect(page.getByRole("heading", { name: "My Projects" })).toBeVisible();
  await page.screenshot({ path: `docs/native-chat/screenshots/c6-${testInfo.project.name}-projects.png`, fullPage: true });
  await page.goto(`/account`);
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await page.screenshot({ path: `docs/native-chat/screenshots/c6-${testInfo.project.name}-account.png`, fullPage: true });
  await page.goto(`/projects/${submissionId}/messages`);
  const initialResponse = await page.request.get(`/api/chat/submissions/${submissionId}`);
  if (!initialResponse.ok()) throw new Error(`Initial chat request failed: ${initialResponse.status()} ${await initialResponse.text()}`);
  await expect(page.getByText("Start the team conversation")).toBeVisible();
  await page.screenshot({ path: `docs/native-chat/screenshots/c6-${testInfo.project.name}-messages.png`, fullPage: true });
  const roomSnapshot = await page.request.get(`/api/chat/submissions/${submissionId}`);
  const roomId = ((await roomSnapshot.json()) as { room: { id: string } }).room.id;
  await page.getByLabel("Message your team").fill("Owner message <b>stays text</b>");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Owner message <b>stays text</b>", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Owner message <b>stays text</b>", { exact: true })).toBeVisible();
  const scriptText = (await page.locator("script").allTextContents()).join("\n");
  expect(scriptText).not.toContain("Owner message <b>stays text</b>");

  await page.goto(`/submit/${editToken}/team`);
  await page.getByRole("button", { name: "Invite teammate" }).click();
  await page.getByRole("button", { name: "Create invitation link" }).click();
  await page.getByText("Show private link").click();
  const inviteInput = page.locator("input[readonly]").last();
  await expect(inviteInput).toHaveValue(/\/projects\/join\//);
  const invitation = await inviteInput.inputValue();
  const invitationToken = new URL(invitation).pathname.split("/").pop() ?? "";
  const sqlite = new Database(process.env.PLAYWRIGHT_C3_DB_FILE!, { readonly: true });
  const invitationRow = sqlite.prepare("SELECT token_hash FROM submission_membership_invitations WHERE submission_id = ? ORDER BY created_at DESC LIMIT 1").get(submissionId) as { token_hash: string } | undefined;
  const invitationAudit = sqlite.prepare("SELECT metadata FROM audit_events WHERE action = 'submission_membership_invited' ORDER BY created_at DESC LIMIT 1").get() as { metadata: string } | undefined;
  sqlite.close();
  expect(invitationRow?.token_hash).toBeTruthy();
  expect(invitationRow?.token_hash).not.toBe(invitationToken);
  expect(invitationAudit?.metadata ?? "").not.toContain(invitationToken);
  await page.goto(`/projects/${submissionId}/messages`);

  const teammateContext = await browser.newContext();
  const teammatePage = await teammateContext.newPage();
  await teammatePage.goto(invitation);
  await teammatePage.goto("/login?returnTo=%2Fprojects%2Fjoin");
  await signIn(teammatePage, teammate.email, teammatePassword);
  await expect(teammatePage).toHaveURL(/\/projects\/join$/);
  await expect(teammatePage.getByRole("heading", { name: /Join C3 Test Team/ })).toBeVisible();
  await teammatePage.getByRole("button", { name: "Join project" }).click();
  await expect(teammatePage).toHaveURL(new RegExp(`/projects/${submissionId}\\?joined=1`));

  await page.getByLabel("Message your team").fill("Owner to teammate");
  await page.getByRole("button", { name: "Send" }).click();
  const unreadBeforeOpen = await teammatePage.request.get(`/api/chat/rooms/${roomId}/unread`);
  expect(unreadBeforeOpen.ok()).toBeTruthy();
  expect((await unreadBeforeOpen.json() as { count: number }).count).toBeGreaterThan(0);
  await teammatePage.goto(`/projects/${submissionId}/messages`);
  await expect(teammatePage.getByText("Owner message <b>stays text</b>", { exact: true })).toBeVisible({ timeout: 8_000 });
  await expect(teammatePage.getByText("Owner to teammate", { exact: true })).toBeVisible({ timeout: 8_000 });

  await page.getByLabel("Message your team").fill("Owner live delivery");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(teammatePage.getByText("Owner live delivery", { exact: true })).toBeVisible({ timeout: 8_000 });

  await teammatePage.getByLabel("Message your team").fill("Teammate reply");
  await teammatePage.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Teammate reply", { exact: true })).toBeVisible({ timeout: 8_000 });

  const databaseFile = process.env.PLAYWRIGHT_C3_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_C3_DB_FILE is required.");
  const teammateMembershipId = await membershipId(databaseFile, teammate.id);
  const revoke = await page.request.delete(`/api/submission-memberships/${teammateMembershipId}`, { data: { submissionId } });
  expect(revoke.ok()).toBeTruthy();
  const immediateDenied = await teammatePage.request.get(`/api/chat/submissions/${submissionId}`);
  expect(immediateDenied.status()).toBe(403);
  const revokeCommittedAt = Date.now();
  const ownerAfterRevoke = await page.request.post(`/api/chat/submissions/${submissionId}`, { data: { body: "Owner after revoke", clientMessageId: `owner-after-revoke-${runNonce}` } });
  expect(ownerAfterRevoke.ok()).toBeTruthy();
  await teammatePage.waitForTimeout(2_000);
  const revokedAt = Date.now();
  expect(revokedAt - revokeCommittedAt).toBeLessThan(5_000);
  await expect.poll(async () => (await teammatePage.evaluate(() => document.body.innerText)).toLowerCase().includes("access revoked"), { timeout: 8_000 }).toBeTruthy();
  expect(await teammatePage.getByText("Owner after revoke", { exact: true }).count()).toBe(0);
  const deniedHistory = await teammatePage.request.get(`/api/chat/submissions/${submissionId}`);
  expect(deniedHistory.status()).toBe(403);
  const deniedUnread = await teammatePage.request.get(`/api/chat/rooms/${roomId}/unread`);
  expect(deniedUnread.status()).toBe(403);
  await teammatePage.reload();
  await expect(teammatePage.getByText("This team room is private")).toBeVisible();

  const repeatedRevoke = await page.request.delete(`/api/submission-memberships/${teammateMembershipId}`, { data: { submissionId } });
  expect(repeatedRevoke.ok()).toBeTruthy();
  const regrantInvite = await page.request.post("/api/submission-memberships/invitations", { data: { submissionId } });
  expect(regrantInvite.ok()).toBeTruthy();
  const regrantInviteUrl = ((await regrantInvite.json()) as { inviteUrl: string }).inviteUrl;
  await teammatePage.goto(regrantInviteUrl);
  await expect(teammatePage.getByRole("heading", { name: /Join C3 Test Team/ })).toBeVisible();
  await teammatePage.getByRole("button", { name: "Join project" }).click();
  await expect(teammatePage).toHaveURL(new RegExp(`/projects/${submissionId}\\?joined=1`));
  const regrantAccess = await teammatePage.request.get(`/api/chat/submissions/${submissionId}`);
  expect(regrantAccess.ok()).toBeTruthy();
  const membershipDb = new Database(databaseFile, { readonly: true });
  const activeMemberships = membershipDb.prepare("SELECT COUNT(*) AS count FROM submission_memberships WHERE submission_id = ? AND user_id = ? AND role = 'teammate' AND status = 'active'").get(submissionId, teammate.id) as { count: number };
  const roomCount = membershipDb.prepare("SELECT COUNT(*) AS count FROM chat_rooms WHERE submission_id = ? AND status = 'active'").get(submissionId) as { count: number };
  membershipDb.close();
  expect(activeMemberships.count).toBe(1);
  expect(roomCount.count).toBe(1);
  await teammatePage.goto(`/projects/${submissionId}/messages`);
  await expect(teammatePage.getByLabel("Message your team")).toBeVisible();
  const finalRevoke = await page.request.delete(`/api/submission-memberships/${await membershipId(databaseFile, teammate.id)}`, { data: { submissionId } });
  expect(finalRevoke.ok()).toBeTruthy();

  await teammateContext.close();
  if (testInfo.project.name === "mobile-chromium") await expect(page.getByLabel("Message your team")).toBeVisible();
});

test("unrelated and signed-out users cannot read a room", async ({ page, browser }) => {
  await signIn(page, unrelated.email, unrelatedPassword);
  await page.goto(`/projects/${submissionId}/messages`);
  await expect(page.getByText("This team room is private")).toBeVisible();
  const signedOut = await browser.newPage();
  await signedOut.goto(`/projects/${submissionId}/messages`);
  await expect(signedOut.getByRole("heading", { name: "Sign in to view messages" })).toBeVisible();
  await signedOut.close();
});

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  if (!new URL(page.url()).pathname.startsWith("/login")) await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 12_000 }).not.toBe("/login");
}

async function membershipId(databaseFile: string, userId: string) {
  const sqlite = new Database(databaseFile, { readonly: true });
  const row = sqlite.prepare("SELECT id FROM submission_memberships WHERE submission_id = ? AND user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").get(submissionId, userId) as { id: string } | undefined;
  sqlite.close();
  if (!row) throw new Error("teammate membership missing");
  return row.id;
}
