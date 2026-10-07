import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";

const password = "D3-calibration-password-123!";
const ids = { admin: "d3-admin", participant: "d3-participant", judge: "d3-judge", profile: "d3-profile", submission: "sub_d3_a", assignment: "d3-assignment" };

test.beforeAll(async () => {
  const databaseFile = process.env.PLAYWRIGHT_D3_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_D3_DB_FILE is required.");
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);
  const sqlite = new Database(databaseFile);
  sqlite.pragma("foreign_keys=ON");
  if (sqlite.prepare("SELECT 1 FROM users WHERE id = ?").get(ids.admin)) { sqlite.close(); return; }
  sqlite.transaction(() => {
    for (const [table, column] of [["calibration_consensus_reviews", "id"], ["calibration_thresholds", "id"], ["judging_evaluation_states", "id"], ["judging_assignment_states", "id"], ["human_scores", "id"], ["judge_assignments", "id"], ["team_members", "id"], ["submissions", "id"], ["judge_authorizations", "id"], ["judges", "id"], ["admin_authorizations", "id"], ["sessions", "user_id"], ["user_account_controls", "user_id"], ["accounts", "user_id"], ["users", "id"]] as const) sqlite.prepare(`DELETE FROM ${table} WHERE ${column} LIKE 'd3-%' OR ${column} LIKE 'sub_d3_%'`).run();
    sqlite.prepare("UPDATE events SET is_active=0,updated_at=?").run(now);
    sqlite.prepare("INSERT INTO events (id,name,slug,is_active,is_frozen,created_at,updated_at) VALUES ('evt_vibe_2025','D3 Calibration Event','d3-calibration',1,0,?,?) ON CONFLICT(id) DO UPDATE SET is_active=1,updated_at=excluded.updated_at").run(now, now);
    const user = sqlite.prepare("INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)");
    const account = sqlite.prepare("INSERT INTO accounts (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?, 'credential',?,?,?,?)");
    const control = sqlite.prepare("INSERT INTO user_account_controls (user_id,status,password_change_required,created_at,updated_at) VALUES (?,'active',0,?,?)");
    for (const [id, name, email] of [[ids.admin, "D3 Organizer", "d3-organizer@example.invalid"], [ids.participant, "D3 Participant", "d3-participant@example.invalid"], [ids.judge, "D3 Judge", "d3-judge@example.invalid"]] as const) { user.run(id, name, email, now, now); account.run(`account-${id}`, id, id, passwordHash, now, now); control.run(id, now, now); }
    sqlite.prepare("INSERT INTO admin_authorizations (id,user_id,status,grant_source,created_at,updated_at) VALUES (?,?,'active','d3-fixture',?,?)").run("d3-admin-auth", ids.admin, now, now);
    sqlite.prepare("INSERT INTO judges (id,token,name,email,created_at) VALUES (?,?,?,?,?)").run(ids.profile, "d3-token", "D3 Judge", "d3-judge-profile@example.invalid", now);
    sqlite.prepare("INSERT INTO judge_authorizations (id,user_id,judge_id,event_id,status,grant_provenance,accepted_at,created_at,updated_at) VALUES (?,?,?,'evt_vibe_2025','active','d3-fixture',?,?,?)").run("d3-auth", ids.judge, ids.profile, now, now, now);
    sqlite.prepare("INSERT INTO submissions (id,event_id,edit_token,status,team_name,contact_email,project_title,problem_statement,created_at) VALUES (?,?,?,'finalized',?,?,?,?,?)").run(ids.submission, "evt_vibe_2025", "d3-edit", "D3 Calibration Team", "d3-owner@example.invalid", "D3 Calibration Project", "Synthetic calibration project", now);
    sqlite.prepare("INSERT INTO team_members (id,submission_id,name,affiliation,\"order\") VALUES (?,?,?,?,?)").run("d3-member", ids.submission, "D3 Member", "D3 Lab", 0);
    sqlite.prepare("INSERT INTO judge_assignments (id,judge_id,submission_id,created_at) VALUES (?,?,?,?)").run(ids.assignment, ids.profile, ids.submission, now);
    sqlite.prepare("INSERT INTO human_scores (id,submission_id,judge_id,problem_selection,product_usefulness,functionality,ux_design,ai_collaboration,originality,maintainability,presentation_clarity,recommendation,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("d3-score", ids.submission, ids.profile, 8,8,8,8,8,8,8,8, "yes", 1, now - 100, now);
    sqlite.prepare("INSERT INTO judging_assignment_states (id,assignment_id,status,conflict_status,created_at,updated_at) VALUES (?,?, 'active','clear',?,?)").run("d3-state", ids.assignment, now, now);
    sqlite.prepare("INSERT INTO judging_evaluation_states (id,assignment_id,status,created_at,updated_at) VALUES (?,?, 'submitted',?,?)").run("d3-eval", ids.assignment, now, now);
  })();
  sqlite.close();
});

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto(`/login?returnTo=${encodeURIComponent("/admin/calibration")}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 12_000 }).not.toBe("/login");
}

test("administrator sees calibration evidence and detail", async ({ page }) => {
  await signIn(page, "d3-organizer@example.invalid");
  await page.goto("/admin/calibration");
  await expect(page.getByRole("heading", { name: "Calibration", exact: true })).toBeVisible();
  await expect(page.getByText("D3 Calibration Project", { exact: true })).toBeVisible();
  await expect(page.getByText("Completed evaluations", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "D3 Calibration Project" }).click();
  await expect(page.getByRole("heading", { name: "Where scores converge" })).toBeVisible();
});

test("participant is denied and mobile calibration has no overflow", async ({ page }) => {
  await signIn(page, "d3-participant@example.invalid");
  await page.goto("/admin/calibration");
  await expect(page).not.toHaveURL(/\/admin\/calibration/);
  await page.context().clearCookies();
  await signIn(page, "d3-organizer@example.invalid");
  await page.goto("/admin/calibration");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("administrator can record a bounded consensus review", async ({ page }) => {
  await signIn(page, "d3-organizer@example.invalid");
  await page.goto(`/admin/calibration/${ids.submission}`);
  const start = page.getByRole("button", { name: "Start review" });
  if (await start.isVisible().catch(() => false)) {
    await start.click();
    await expect(page.getByRole("button", { name: "Mark complete" })).toBeVisible();
  }
  const note = page.getByPlaceholder("Capture the discussion outcome without copying private judge notes.");
  await note.fill("Synthetic panel discussion recorded for calibration.");
  await page.getByRole("button", { name: "Add note" }).click();
  const complete = page.getByRole("button", { name: "Mark complete" });
  if (await complete.isVisible().catch(() => false)) await complete.click();
  await expect(page.getByText("Consensus complete", { exact: true })).toBeVisible();
});
