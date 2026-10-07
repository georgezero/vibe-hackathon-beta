import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";

const password = "D2-results-password-123!";
const ids = { admin: "d2-admin", participant: "d2-participant", judgeA: "d2-judge-a", judgeB: "d2-judge-b", profileA: "d2-profile-a", profileB: "d2-profile-b", subA: "sub_d2_a", subB: "sub_d2_b", assignmentA: "d2-assignment-a", assignmentB: "d2-assignment-b" };

test.beforeAll(async () => {
  const databaseFile = process.env.PLAYWRIGHT_D2_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_D2_DB_FILE is required.");
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);
  const sqlite = new Database(databaseFile);
  sqlite.pragma("foreign_keys=ON");
  sqlite.transaction(() => {
    for (const [table, column] of [["result_publication_states", "event_id"], ["result_winners", "id"], ["result_finalists", "id"], ["result_tie_review_submissions", "id"], ["result_tie_reviews", "id"], ["judging_evaluation_states", "id"], ["judging_assignment_states", "id"], ["human_scores", "id"], ["judge_assignments", "id"], ["team_members", "id"], ["submissions", "id"], ["judge_authorizations", "id"], ["judges", "id"], ["admin_authorizations", "id"], ["sessions", "user_id"], ["user_account_controls", "user_id"], ["accounts", "user_id"], ["users", "id"]] as const) sqlite.prepare(`DELETE FROM ${table} WHERE ${column} LIKE 'd2-%' OR ${column} LIKE 'sub_d2_%'`).run();
    sqlite.prepare("UPDATE events SET is_active=0,updated_at=?").run(now);
    sqlite.prepare("INSERT INTO events (id,name,slug,is_active,is_frozen,created_at,updated_at) VALUES ('evt_vibe_2025','D2 Results Event','d2-results',1,0,?,?) ON CONFLICT(id) DO UPDATE SET is_active=1,updated_at=excluded.updated_at").run(now, now);
    const user = sqlite.prepare("INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)");
    const account = sqlite.prepare("INSERT INTO accounts (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?, 'credential',?,?,?,?)");
    const control = sqlite.prepare("INSERT INTO user_account_controls (user_id,status,password_change_required,created_at,updated_at) VALUES (?,'active',0,?,?)");
    for (const [id, name, email] of [[ids.admin, "D2 Organizer", "d2-organizer@example.invalid"], [ids.participant, "D2 Participant", "d2-participant@example.invalid"], [ids.judgeA, "D2 Judge A", "d2-judge-a@example.invalid"], [ids.judgeB, "D2 Judge B", "d2-judge-b@example.invalid"]] as const) { user.run(id, name, email, now, now); account.run(`account-${id}`, id, id, passwordHash, now, now); control.run(id, now, now); }
    sqlite.prepare("INSERT INTO admin_authorizations (id,user_id,status,grant_source,created_at,updated_at) VALUES (?,?,'active','d2-fixture',?,?)").run("d2-admin-auth", ids.admin, now, now);
    const judge = sqlite.prepare("INSERT INTO judges (id,token,name,email,created_at) VALUES (?,?,?,?,?)"); judge.run(ids.profileA, "d2-token-a", "D2 Judge A", "d2-judge-profile-a@example.invalid", now); judge.run(ids.profileB, "d2-token-b", "D2 Judge B", "d2-judge-profile-b@example.invalid", now);
    const auth = sqlite.prepare("INSERT INTO judge_authorizations (id,user_id,judge_id,event_id,status,grant_provenance,accepted_at,created_at,updated_at) VALUES (?,?,?,'evt_vibe_2025','active','d2-fixture',?,?,?)"); auth.run("d2-auth-a", ids.judgeA, ids.profileA, now, now, now); auth.run("d2-auth-b", ids.judgeB, ids.profileB, now, now, now);
    const sub = sqlite.prepare("INSERT INTO submissions (id,event_id,edit_token,status,team_name,contact_email,project_title,problem_statement,created_at) VALUES (?,?,?,'finalized',?,?,?,?,?)"); sub.run(ids.subA, "evt_vibe_2025", "d2-edit-a", "D2 Team A", "d2-owner-a@example.invalid", "D2 Project A", "Synthetic ranking project A", now); sub.run(ids.subB, "evt_vibe_2025", "d2-edit-b", "D2 Team B", "d2-owner-b@example.invalid", "D2 Project B", "Synthetic ranking project B", now);
    const member = sqlite.prepare("INSERT INTO team_members (id,submission_id,name,affiliation,\"order\") VALUES (?,?,?,?,?)"); member.run("d2-member-a", ids.subA, "D2 Member A", "D2 Lab", 0); member.run("d2-member-b", ids.subB, "D2 Member B", "D2 Lab", 0);
    sqlite.prepare("INSERT INTO judge_assignments (id,judge_id,submission_id,created_at) VALUES (?,?,?,?)").run(ids.assignmentA, ids.profileA, ids.subA, now); sqlite.prepare("INSERT INTO judge_assignments (id,judge_id,submission_id,created_at) VALUES (?,?,?,?)").run(ids.assignmentB, ids.profileB, ids.subB, now);
    const score = sqlite.prepare("INSERT INTO human_scores (id,submission_id,judge_id,problem_selection,product_usefulness,functionality,ux_design,ai_collaboration,originality,maintainability,presentation_clarity,recommendation,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"); score.run("d2-score-a", ids.subA, ids.profileA, 8,8,8,8,8,8,8,8, "yes", 1, now - 200, now); score.run("d2-score-b", ids.subB, ids.profileB, 7,7,7,7,7,7,7,7, "yes", 1, now - 100, now);
    const assignmentState = sqlite.prepare("INSERT INTO judging_assignment_states (id,assignment_id,status,conflict_status,created_at,updated_at) VALUES (?,?, 'active','clear',?,?)"); assignmentState.run("d2-state-a", ids.assignmentA, now, now); assignmentState.run("d2-state-b", ids.assignmentB, now, now);
    const evalState = sqlite.prepare("INSERT INTO judging_evaluation_states (id,assignment_id,status,created_at,updated_at) VALUES (?,?, 'submitted',?,?)"); evalState.run("d2-eval-a", ids.assignmentA, now, now); evalState.run("d2-eval-b", ids.assignmentB, now, now);
    sqlite.prepare("INSERT INTO result_publication_states (id,event_id,status,updated_at) VALUES ('d2-publication','evt_vibe_2025','calculated',?) ON CONFLICT(event_id) DO NOTHING").run(now);
  })();
  sqlite.close();
});

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto(`/login?returnTo=${encodeURIComponent("/admin/results")}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 12_000 }).not.toBe("/login");
}

test("administrator can review synthetic rankings and open a tie-safe result detail", async ({ page }) => {
  await signIn(page, "d2-organizer@example.invalid");
  await page.goto("/admin/results");
  await expect(page.getByRole("heading", { name: "Results" }).first()).toBeVisible();
  await expect(page.getByText("D2 Project A", { exact: true })).toBeVisible();
  await expect(page.getByText("Ranked", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "D2 Project A" }).click();
  await expect(page.getByRole("heading", { name: "D2 Project A" })).toBeVisible();
  await expect(page.getByText("Completed evaluations", { exact: true })).toBeVisible();
});

test("participant cannot access results and mobile results do not overflow", async ({ page }) => {
  await signIn(page, "d2-participant@example.invalid");
  await page.goto("/admin/results");
  await expect(page).not.toHaveURL(/\/admin\/results/);
  await page.context().clearCookies();
  await signIn(page, "d2-organizer@example.invalid");
  await page.goto("/admin/results");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
