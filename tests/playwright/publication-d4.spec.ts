import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";

const password = "D4-publication-password-123!";
const ids = { admin: "d4-admin", participant: "d4-participant", submission: "sub_d4_publication", member: "d4-member", ownerMembership: "d4-owner-membership", assignment: "d4-assignment", judge: "d4-judge", judgeProfile: "d4-judge-profile" };

test.beforeAll(async () => {
  const databaseFile = process.env.PLAYWRIGHT_D4_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_D4_DB_FILE is required.");
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);
  const sqlite = new Database(databaseFile);
  sqlite.pragma("foreign_keys=ON");
  if (sqlite.prepare("SELECT 1 FROM users WHERE id = ?").get(ids.admin)) { sqlite.close(); return; }
  sqlite.transaction(() => {
    for (const [table, column] of [["publication_announcements", "id"], ["publication_feedback_comments", "id"], ["publication_feedback", "id"], ["publication_awards", "id"], ["publication_releases", "id"], ["human_scores", "id"], ["judging_evaluation_states", "id"], ["judging_assignment_states", "id"], ["judge_assignments", "id"], ["submission_memberships", "id"], ["team_members", "id"], ["submissions", "id"], ["judge_authorizations", "id"], ["judges", "id"], ["admin_authorizations", "id"], ["sessions", "user_id"], ["user_account_controls", "user_id"], ["accounts", "user_id"], ["users", "id"]] as const) sqlite.prepare(`DELETE FROM ${table} WHERE ${column} LIKE 'd4-%' OR ${column} LIKE 'sub_d4_%'`).run();
    sqlite.prepare("UPDATE events SET is_active=0,updated_at=?").run(now);
    sqlite.prepare("INSERT INTO events (id,name,slug,is_active,is_frozen,created_at,updated_at) VALUES ('evt_vibe_2025','D4 Publication Event','d4-publication',1,0,?,?) ON CONFLICT(id) DO UPDATE SET is_active=1,updated_at=excluded.updated_at").run(now, now);
    const user = sqlite.prepare("INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)");
    const account = sqlite.prepare("INSERT INTO accounts (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?, 'credential',?,?,?,?)");
    const control = sqlite.prepare("INSERT INTO user_account_controls (user_id,status,password_change_required,created_at,updated_at) VALUES (?,'active',0,?,?)");
    for (const [id, name, email] of [[ids.admin, "D4 Organizer", "d4-organizer@example.invalid"], [ids.participant, "D4 Participant", "d4-participant@example.invalid"], [ids.judge, "D4 Judge Account", "d4-judge-account@example.invalid"]] as const) { user.run(id, name, email, now, now); account.run(`account-${id}`, id, id, passwordHash, now, now); control.run(id, now, now); }
    sqlite.prepare("INSERT INTO admin_authorizations (id,user_id,status,grant_source,created_at,updated_at) VALUES (?,?,'active','d4-fixture',?,?)").run("d4-admin-auth", ids.admin, now, now);
    sqlite.prepare("INSERT INTO judges (id,token,name,email,created_at) VALUES (?,?,?,?,?)").run(ids.judgeProfile, "d4-token", "D4 Judge", "d4-judge@example.invalid", now);
    sqlite.prepare("INSERT INTO judge_authorizations (id,user_id,judge_id,event_id,status,grant_provenance,accepted_at,created_at,updated_at) VALUES (?,?,?,'evt_vibe_2025','active','d4-fixture',?,?,?)").run("d4-judge-auth", ids.judge, ids.judgeProfile, now, now, now);
    sqlite.prepare("INSERT INTO submissions (id,event_id,edit_token,status,team_name,contact_email,project_title,problem_statement,created_at) VALUES (?,?,?,'finalized',?,?,?,?,?)").run(ids.submission, "evt_vibe_2025", "d4-edit", "D4 Publication Team", "d4-owner@example.invalid", "D4 Publication Project", "Synthetic publication project", now);
    sqlite.prepare("INSERT INTO team_members (id,submission_id,name,affiliation,\"order\") VALUES (?,?,?,?,?)").run(ids.member, ids.submission, "D4 Member", "D4 Lab", 0);
    sqlite.prepare("INSERT INTO submission_memberships (id,submission_id,user_id,role,status,created_at,updated_at) VALUES (?,?,?,'owner','active',?,?)").run(ids.ownerMembership, ids.submission, ids.participant, now, now);
    sqlite.prepare("INSERT INTO judge_assignments (id,judge_id,submission_id,created_at) VALUES (?,?,?,?)").run(ids.assignment, ids.judgeProfile, ids.submission, now);
    sqlite.prepare("INSERT INTO human_scores (id,submission_id,judge_id,problem_selection,product_usefulness,functionality,ux_design,ai_collaboration,originality,maintainability,presentation_clarity,private_notes,recommendation,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("d4-score", ids.submission, ids.judgeProfile, 9,9,8,9,8,9,8,9, "D4 PRIVATE NOTE MUST NOT APPEAR", "strong-yes", 1, now - 100, now);
    sqlite.prepare("INSERT INTO judging_assignment_states (id,assignment_id,status,conflict_status,created_at,updated_at) VALUES (?,?, 'active','clear',?,?)").run("d4-state", ids.assignment, now, now);
    sqlite.prepare("INSERT INTO judging_evaluation_states (id,assignment_id,status,created_at,updated_at) VALUES (?,?, 'submitted',?,?)").run("d4-eval", ids.assignment, now, now);
  })();
  sqlite.close();
});

async function signIn(page: import("@playwright/test").Page, email: string, returnTo: string) {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 12_000 }).not.toBe("/login");
}

test.describe.configure({ mode: "serial" });

test("administrator can review, approve, publish, and assign an award", async ({ page }, testInfo) => {
  page.on("dialog", (dialog) => dialog.accept());
  await signIn(page, "d4-organizer@example.invalid", "/admin/publication");
  await page.goto("/admin/publication");
  await expect(page.getByRole("heading", { name: "Publication", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "D4 Publication Project", exact: true })).toBeVisible();
  await expect(page.getByText("D4 PRIVATE NOTE MUST NOT APPEAR", { exact: true })).not.toBeVisible();
  const review = page.getByRole("button", { name: "Mark reviewed" });
  if (await review.isVisible().catch(() => false)) {
    await review.click();
    await page.getByRole("button", { name: "Approve publication" }).click();
  }
  const assign = page.getByRole("button", { name: "Assign" });
  if (await assign.isVisible().catch(() => false)) await assign.click();
  const publish = page.getByRole("button", { name: "Publish results" });
  if (await publish.isVisible().catch(() => false)) await publish.click();
  await expect(page.getByRole("heading", { name: "Published", exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("admin-publication.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("active workspace member sees published result and admin route is protected", async ({ page }, testInfo) => {
  await signIn(page, "d4-participant@example.invalid", `/projects/${ids.submission}/results`);
  await page.goto(`/projects/${ids.submission}/results`);
  await expect(page.getByRole("heading", { name: "D4 Publication Project", exact: true })).toBeVisible();
  await expect(page.getByText("Grand Prize", { exact: true })).toBeVisible();
  await expect(page.getByText("D4 PRIVATE NOTE MUST NOT APPEAR", { exact: true })).not.toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("participant-results.png"), fullPage: true });
  await page.goto("/admin/publication");
  await expect(page).not.toHaveURL(/\/admin\/publication/);
});
