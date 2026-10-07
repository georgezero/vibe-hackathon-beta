import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";

const password = "D1-command-center-password-123!";
const ids = { admin: "d1-admin", judge: "d1-judge", participant: "d1-participant", submitted: "sub_d1_submitted", draft: "sub_d1_draft", unassigned: "sub_d1_unassigned", judgeProfile: "d1-judge-profile" };

test.beforeAll(async () => {
  const databaseFile = process.env.PLAYWRIGHT_D1_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_D1_DB_FILE is required.");
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);
  const sqlite = new Database(databaseFile);
  sqlite.pragma("foreign_keys=ON");
  sqlite.transaction(() => {
    for (const [table, column] of [["judging_evaluation_states", "id"], ["judging_assignment_states", "id"], ["human_scores", "id"], ["judge_assignments", "id"], ["submission_memberships", "id"], ["submission_owners", "id"], ["team_members", "id"], ["submissions", "id"], ["judge_authorizations", "id"], ["judges", "id"], ["admin_authorizations", "id"], ["sessions", "user_id"], ["user_account_controls", "user_id"], ["accounts", "user_id"], ["users", "id"]] as const) {
      sqlite.prepare(`DELETE FROM ${table} WHERE ${column} LIKE 'd1-%' OR ${column} LIKE 'sub_d1_%'`).run();
    }
    sqlite.prepare("UPDATE events SET is_active=0,updated_at=?").run(now);
    sqlite.prepare("INSERT INTO events (id,name,slug,is_active,is_frozen,created_at,updated_at) VALUES ('evt_vibe_2025','D1 Command Center Event','d1-command-center',1,0,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,is_active=1,is_frozen=0,updated_at=excluded.updated_at").run(now, now);
    const user = sqlite.prepare("INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)");
    const account = sqlite.prepare("INSERT INTO accounts (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?, 'credential',?,?,?,?)");
    const control = sqlite.prepare("INSERT INTO user_account_controls (user_id,status,password_change_required,created_at,updated_at) VALUES (?,'active',0,?,?)");
    for (const [id, name, email] of [[ids.admin, "D1 Organizer", "d1-organizer@example.invalid"], [ids.judge, "D1 Judge", "d1-judge@example.invalid"], [ids.participant, "D1 Participant", "d1-participant@example.invalid"]] as const) { user.run(id, name, email, now, now); account.run(`account-${id}`, id, id, passwordHash, now, now); control.run(id, now, now); }
    sqlite.prepare("INSERT INTO admin_authorizations (id,user_id,status,grant_source,created_at,updated_at) VALUES (?,?,'active','d1-fixture',?,?)").run("d1-admin-auth", ids.admin, now, now);
    sqlite.prepare("INSERT INTO judges (id,token,name,email,created_at) VALUES (?,?,?,?,?)").run(ids.judgeProfile, "d1-fixture-token", "D1 Judge", "d1-judge-profile@example.invalid", now);
    sqlite.prepare("INSERT INTO judge_authorizations (id,user_id,judge_id,event_id,status,grant_provenance,accepted_at,created_at,updated_at) VALUES (?,?,?,'evt_vibe_2025','active','d1-fixture',?,?,?)").run("d1-judge-auth", ids.judge, ids.judgeProfile, now, now, now);
    const sub = sqlite.prepare("INSERT INTO submissions (id,event_id,edit_token,status,team_name,contact_email,project_title,problem_statement,target_users,created_at) VALUES (?,?,?,'finalized',?,?,?,?,?,?)");
    sub.run(ids.submitted, "evt_vibe_2025", "d1-edit-submitted", "D1 Submitted Team", "d1-participant@example.invalid", "D1 Submitted Project", "Synthetic submitted project", "Judges", now);
    sub.run(ids.draft, "evt_vibe_2025", "d1-edit-draft", "D1 Draft Team", "d1-participant@example.invalid", "D1 Draft Project", "Synthetic draft project", "Judges", now);
    sub.run(ids.unassigned, "evt_vibe_2025", "d1-edit-unassigned", "D1 Unassigned Team", "d1-participant@example.invalid", "D1 Unassigned Project", "Synthetic unassigned project", "Judges", now);
    const member = sqlite.prepare("INSERT INTO team_members (id,submission_id,name,email,affiliation,\"order\") VALUES (?,?,?,?,?,?)");
    member.run("d1-member-submitted", ids.submitted, "D1 Participant", "d1-participant@example.invalid", "D1 Lab", 0); member.run("d1-member-draft", ids.draft, "D1 Participant", "d1-participant@example.invalid", "D1 Lab", 0); member.run("d1-member-unassigned", ids.unassigned, "D1 Participant", "d1-participant@example.invalid", "D1 Lab", 0);
    sqlite.prepare("INSERT INTO judge_assignments (id,judge_id,submission_id,created_at) VALUES (?,?,?,?)").run("d1-assignment-submitted", ids.judgeProfile, ids.submitted, now);
    sqlite.prepare("INSERT INTO judge_assignments (id,judge_id,submission_id,created_at) VALUES (?,?,?,?)").run("d1-assignment-draft", ids.judgeProfile, ids.draft, now);
    const score = sqlite.prepare("INSERT INTO human_scores (id,submission_id,judge_id,problem_selection,product_usefulness,functionality,ux_design,ai_collaboration,originality,maintainability,presentation_clarity,private_notes,recommendation,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    score.run("d1-score-submitted", ids.submitted, ids.judgeProfile, 8,8,8,8,8,8,8,8, "synthetic private note", "yes", 1, now-600, now);
    score.run("d1-score-draft", ids.draft, ids.judgeProfile, 7,7,7,7,7,7,7,7, "synthetic draft note", "maybe", 0, now-300, now);
    sqlite.prepare("INSERT INTO judging_assignment_states (id,assignment_id,status,conflict_status,created_at,updated_at) VALUES (?,?, 'active','clear',?,?)").run("d1-assignment-state-submitted", "d1-assignment-submitted", now, now);
    sqlite.prepare("INSERT INTO judging_assignment_states (id,assignment_id,status,conflict_status,created_at,updated_at) VALUES (?,?, 'active','clear',?,?)").run("d1-assignment-state-draft", "d1-assignment-draft", now, now);
    sqlite.prepare("INSERT INTO judging_evaluation_states (id,assignment_id,status,created_at,updated_at) VALUES (?,?, 'submitted',?,?)").run("d1-eval-state-submitted", "d1-assignment-submitted", now, now);
    sqlite.prepare("INSERT INTO judging_evaluation_states (id,assignment_id,status,created_at,updated_at) VALUES (?,?, 'draft',?,?)").run("d1-eval-state-draft", "d1-assignment-draft", now, now);
  })();
  sqlite.close();
});

async function signIn(page: import("@playwright/test").Page, email: string, returnTo = "/admin/judging") {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 12_000 }).not.toBe("/login");
}

test("administrator sees the command center and can freeze/reopen a synthetic evaluation", async ({ page }, testInfo) => {
  page.on("response", async (response) => { if (response.url().includes("/api/admin/judging")) console.log("D1 judging mutation", response.status(), await response.text().catch(() => "")); });
  await signIn(page, "d1-organizer@example.invalid");
  await page.goto("/admin/judging");
  await expect(page.getByRole("heading", { name: "Judging command center" })).toBeVisible();
  await expect(page.getByText("Competition health", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("D1 Submitted Project", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("D1 Unassigned Project", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /D1 Submitted Project/ }).click();
  await page.getByRole("button", { name: "Freeze evaluation" }).click();
  await expect(page.getByText("Frozen", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect.poll(() => page.locator("body").innerText(), { timeout: 8_000 }).toContain("Reopened");
  await page.screenshot({ path: `docs/judging/screenshots/d1-${testInfo.project.name}-command-center.png`, fullPage: true });
});

test("judge and signed-out users cannot access the admin command center", async ({ page }) => {
  await signIn(page, "d1-judge@example.invalid", "/admin/judging");
  await expect(page).not.toHaveURL(/\/admin\/judging/);
  await page.context().clearCookies();
  await page.goto("/admin/judging");
  await expect(page).toHaveURL(/\/admin/);
});

test("mobile command center has no horizontal overflow", async ({ page }) => {
  await signIn(page, "d1-organizer@example.invalid");
  await page.goto("/admin/judging");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
