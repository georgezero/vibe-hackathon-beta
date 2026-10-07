import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";

const password = "D0-judge-workspace-password-123!";
const projectA = "sub_d0_judge_a";
const projectB = "sub_d0_judge_b";
const projectUnassigned = "sub_d0_unassigned";

const fixtureUsers = {
  judgeA: { id: "d0-judge-a", email: "d0-judge-a@example.invalid", name: "D0 Judge A" },
  judgeB: { id: "d0-judge-b", email: "d0-judge-b@example.invalid", name: "D0 Judge B" },
  participant: { id: "d0-participant", email: "d0-participant@example.invalid", name: "D0 Participant" },
  admin: { id: "d0-admin", email: "d0-admin@example.invalid", name: "D0 Admin Only" },
};

test.beforeAll(async () => {
  const databaseFile = process.env.PLAYWRIGHT_D0_DB_FILE;
  if (!databaseFile) throw new Error("PLAYWRIGHT_D0_DB_FILE is required.");
  const now = Math.floor(Date.now() / 1000);
  const userPasswordHash = await hashPassword(password);
  const sqlite = new Database(databaseFile);
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    // Each Playwright project shares the disposable database. Remove only this
    // fixture namespace so desktop/mobile runs are independent and repeatable.
    sqlite.prepare("DELETE FROM human_scores WHERE id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM judge_assignments WHERE id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM submission_memberships WHERE id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM submission_owners WHERE id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM team_members WHERE id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM submissions WHERE id LIKE 'sub_d0_%'").run();
    sqlite.prepare("DELETE FROM judge_authorizations WHERE id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM judges WHERE id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM admin_authorizations WHERE id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM sessions WHERE user_id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM user_account_controls WHERE user_id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM accounts WHERE user_id LIKE 'd0-%'").run();
    sqlite.prepare("DELETE FROM users WHERE id LIKE 'd0-%'").run();
    sqlite.prepare(`INSERT INTO events (id,name,slug,is_active,is_frozen,created_at,updated_at) VALUES ('evt_vibe_2025','D0 Judge Workspace Event','d0-judge-workspace',1,0,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,is_active=1,is_frozen=0,updated_at=excluded.updated_at`).run(now, now);
    const insertUser = sqlite.prepare("INSERT INTO users (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)");
    const insertAccount = sqlite.prepare("INSERT INTO accounts (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES (?,?, 'credential',?,?,?,?)");
    const insertControl = sqlite.prepare("INSERT INTO user_account_controls (user_id,status,password_change_required,created_at,updated_at) VALUES (?,'active',0,?,?)");
    for (const user of Object.values(fixtureUsers)) {
      insertUser.run(user.id, user.name, user.email, now, now);
      insertAccount.run(`account-${user.id}`, user.id, user.id, userPasswordHash, now, now);
      insertControl.run(user.id, now, now);
    }
    sqlite.prepare("INSERT INTO admin_authorizations (id,user_id,status,grant_source,created_at,updated_at) VALUES (?,?,'active','d0-fixture',?,?)").run("d0-admin-auth", fixtureUsers.admin.id, now, now);
    const insertJudge = sqlite.prepare("INSERT INTO judges (id,token,name,email,created_at) VALUES (?,?,?,?,?)");
    insertJudge.run("d0-judge-profile-a", "d0-fixture-token-a", "D0 Judge A", "judge-a-profile@example.invalid", now);
    insertJudge.run("d0-judge-profile-b", "d0-fixture-token-b", "D0 Judge B", "judge-b-profile@example.invalid", now);
    const insertJudgeAuth = sqlite.prepare("INSERT INTO judge_authorizations (id,user_id,judge_id,event_id,status,grant_provenance,accepted_at,created_at,updated_at) VALUES (?,?,?,'evt_vibe_2025','active','d0-fixture',?,?,?)");
    insertJudgeAuth.run("d0-judge-auth-a", fixtureUsers.judgeA.id, "d0-judge-profile-a", now, now, now);
    insertJudgeAuth.run("d0-judge-auth-b", fixtureUsers.judgeB.id, "d0-judge-profile-b", now, now, now);
    const insertSubmission = sqlite.prepare("INSERT INTO submissions (id,event_id,edit_token,status,team_name,contact_email,project_title,problem_statement,target_users,github_url,demo_url,created_at) VALUES (?,?,?,'finalized',?,?,?,?,?,?,?,?)");
    insertSubmission.run(projectA, "evt_vibe_2025", "d0-edit-a", "D0 Judge A Team", fixtureUsers.participant.email, "D0 Judge A Project", "A bounded review project.", "Judges", "https://github.com/example/d0-a", "https://demo.invalid/d0-a", now);
    insertSubmission.run(projectB, "evt_vibe_2025", "d0-edit-b", "D0 Judge B Team", "team-b@example.invalid", "D0 Judge B Project", "A second assigned project.", "Judges", "https://github.com/example/d0-b", "https://demo.invalid/d0-b", now);
    insertSubmission.run(projectUnassigned, "evt_vibe_2025", "d0-edit-u", "D0 Unassigned Team", "unassigned@example.invalid", "D0 Unassigned Project", "A project without a judge assignment.", "Judges", null, null, now);
    const insertMember = sqlite.prepare("INSERT INTO team_members (id,submission_id,name,email,affiliation," + '"order"' + ") VALUES (?,?,?,?,?,?)");
    insertMember.run("d0-member-a", projectA, "D0 Participant", fixtureUsers.participant.email, "D0 Lab", 0);
    insertMember.run("d0-member-b", projectB, "D0 Judge B Team Lead", "team-b@example.invalid", "D0 Lab", 0);
    insertMember.run("d0-member-u", projectUnassigned, "D0 Unassigned Lead", "unassigned@example.invalid", "D0 Lab", 0);
    sqlite.prepare("INSERT INTO submission_owners (id,submission_id,user_id,created_at) VALUES (?,?,?,?)").run("d0-owner-a", projectA, fixtureUsers.participant.id, now);
    sqlite.prepare("INSERT INTO submission_memberships (id,submission_id,user_id,role,status,joined_at,created_at,updated_at) VALUES (?,?,?,'owner','active',?,?,?)").run("d0-membership-a", projectA, fixtureUsers.participant.id, now, now, now);
    sqlite.prepare("INSERT INTO judge_assignments (id,judge_id,submission_id,created_at) VALUES (?,?,?,?)").run("d0-assignment-a", "d0-judge-profile-a", projectA, now);
    sqlite.prepare("INSERT INTO judge_assignments (id,judge_id,submission_id,created_at) VALUES (?,?,?,?)").run("d0-assignment-b", "d0-judge-profile-b", projectB, now);
    sqlite.prepare("INSERT INTO human_scores (id,submission_id,judge_id,problem_selection,product_usefulness,functionality,ux_design,ai_collaboration,originality,maintainability,presentation_clarity,private_notes,recommendation,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("d0-score-a", projectA, "d0-judge-profile-a", 8, 8, 7, 9, 8, 8, 7, 8, "D0 private note", "yes", 0, now, now);
  })();
  sqlite.close();
});

async function signIn(page: import("@playwright/test").Page, user: { email: string }, returnTo = "/judge/dashboard") {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 12_000 }).not.toBe("/login");
}

async function logout(page: import("@playwright/test").Page) {
  await page.request.post("/logout", { headers: { Origin: new URL(page.url()).origin } });
  await page.context().clearCookies();
}

test("assigned judge gets the unified workspace and private evaluation", async ({ page }, testInfo) => {
  await signIn(page, fixtureUsers.judgeA);
  await page.goto("/judge/dashboard");
  await expect(page.getByText("D0 Judge A Project", { exact: true })).toBeVisible();
  await expect(page.getByText("D0 Judge B Project", { exact: true })).toHaveCount(0);
  await expect(page.getByText("D0 Unassigned Project", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Review project →" })).toBeVisible();
  await page.screenshot({ path: `docs/judging/screenshots/d0-${testInfo.project.name}-dashboard.png`, fullPage: true });

  await page.goto(`/judge/projects/${projectA}`);
  const nav = page.getByRole("navigation", { name: "Project workspace" });
  for (const label of ["Overview", "Team", "Activity", "Preview", "Submission", "Evaluation"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Messages", exact: true })).toHaveCount(0);
  await expect(page.getByText("D0 Judge A Project", { exact: true })).toBeVisible();

  for (const [path, marker] of [
    ["", "Project snapshot"],
    ["/team", "Project team"],
    ["/activity", "Project activity"],
    ["/preview", "D0 Judge A Project"],
    ["/submission", "Submission"],
    ["/evaluation", "Evaluation"],
  ] as const) {
    await page.goto(`/judge/projects/${projectA}${path}`);
    await expect(page.getByText(marker, { exact: true }).first()).toBeVisible();
  }
  await expect(page.getByText("Private notes (only visible to you)")).toBeVisible();
  await expect(page.getByPlaceholder(/private note about this project/i)).toHaveValue("D0 private note");
  await page.getByPlaceholder(/private note about this project/i).fill("D0 updated private note");
  await page.getByRole("button", { name: "Save progress" }).click();
  await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

  await page.goto(`/judge/submissions/${projectA}`);
  await expect(page).toHaveURL(new RegExp(`/judge/projects/${projectA}/evaluation$`));
  await expect(page.getByRole("heading", { name: "Evaluation", exact: true })).toBeVisible();

  const denied = await page.goto(`/judge/projects/${projectB}`);
  expect(denied?.status()).toBe(404);
  expect((await page.locator("body").innerText())).not.toContain("D0 Judge B Project");
  const deniedScore = await page.request.post("/api/scores", { data: { submissionId: projectB, scores: {}, notes: "should not be visible", recommendation: null, completed: false } });
  expect(deniedScore.status()).toBe(403);
  await page.goto(`/judge/projects/${projectA}`);
  await expect(page.getByText("Project snapshot", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/judging/screenshots/d0-${testInfo.project.name}-workspace.png`, fullPage: true });
});

test("judge and participant role boundaries remain separate", async ({ page, browser }) => {
  await signIn(page, fixtureUsers.judgeA);
  await page.goto(`/judge/projects/${projectA}/evaluation`);
  await expect(page.getByRole("heading", { name: "Evaluation", exact: true })).toBeVisible();
  await logout(page);
  await signIn(page, fixtureUsers.participant, "/account/projects");
  await page.goto(`/projects/${projectA}`);
  await expect(page.getByRole("link", { name: "Messages", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Evaluation", exact: true })).toHaveCount(0);
  await page.goto(`/judge/projects/${projectA}/evaluation`);
  await expect(page).toHaveURL(/\/judge\?reason=not_authorized$/);

  await logout(page);
  await signIn(page, fixtureUsers.admin, "/account");
  await page.goto(`/judge/projects/${projectA}`);
  await expect(page).toHaveURL(/\/judge\?reason=not_authorized$/);

  const judgeB = await browser.newPage();
  await signIn(judgeB, fixtureUsers.judgeB);
  await judgeB.goto("/judge/dashboard");
  await expect(judgeB.getByText("D0 Judge B Project", { exact: true })).toBeVisible();
  await expect(judgeB.getByText("D0 Judge A Project", { exact: true })).toHaveCount(0);
  await judgeB.goto(`/judge/projects/${projectA}`);
  expect((await judgeB.goto(`/judge/projects/${projectA}`))?.status()).toBe(404);
  await judgeB.close();
});
