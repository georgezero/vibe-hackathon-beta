import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("submission membership migration", () => {
  it("is additive, idempotent, and reconciles only explicit owners", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-c2a-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE submissions (id TEXT PRIMARY KEY, edit_token TEXT NOT NULL);
      CREATE TABLE team_members (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id));
      CREATE TABLE submission_owners (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), user_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER);
      INSERT INTO users VALUES ('user-1'), ('user-2');
      INSERT INTO submissions VALUES ('sub_existing', 'edit_existing'), ('sub_unclaimed', 'edit_unclaimed');
      INSERT INTO submission_owners VALUES ('owner-1', 'sub_existing', 'user-1', 100);
      INSERT INTO team_members VALUES ('member-1', 'sub_existing');
    `);
    sqlite.close();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DB_FILE_NAME: database,
      VIBE_TEST_DATABASE_ROOT: root,
      DATABASE_URL: "",
      VIBE_C2A_MIGRATION_CONFIRM: `MIGRATE SUBMISSION MEMBERSHIPS DATABASE ${database}`,
    };
    const args = ["tsx", "scripts/migrate-submission-memberships.ts"];
    const first = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    const second = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    expect(JSON.parse(first)).toMatchObject({ idempotent: true, foreignKeyCheck: "passed" });
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    const check = new Database(database, { readonly: true });
    expect(check.prepare("SELECT count(*) count FROM submissions").get()).toEqual({ count: 2 });
    expect(check.prepare("SELECT count(*) count FROM submission_memberships").get()).toEqual({ count: 1 });
    expect(check.prepare("SELECT count(*) count FROM submission_memberships WHERE role = 'owner' AND status = 'active'").get()).toEqual({ count: 1 });
    expect(check.prepare("SELECT count(*) count FROM submission_membership_invitations").get()).toEqual({ count: 0 });
    expect(check.pragma("foreign_key_check")).toEqual([]);
    check.close();
  });

  it("fails closed when historical owners are ambiguous", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-c2a-ambiguous-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE submissions (id TEXT PRIMARY KEY, edit_token TEXT NOT NULL);
      CREATE TABLE team_members (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id));
      CREATE TABLE submission_owners (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), user_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER);
      INSERT INTO users VALUES ('user-1'), ('user-2');
      INSERT INTO submissions VALUES ('sub_existing', 'edit_existing');
      INSERT INTO submission_owners VALUES ('owner-1', 'sub_existing', 'user-1', 100), ('owner-2', 'sub_existing', 'user-2', 101);
    `);
    sqlite.close();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DB_FILE_NAME: database,
      VIBE_TEST_DATABASE_ROOT: root,
      DATABASE_URL: "",
      VIBE_C2A_MIGRATION_CONFIRM: `MIGRATE SUBMISSION MEMBERSHIPS DATABASE ${database}`,
    };
    expect(() => execFileSync("npx", ["tsx", "scripts/migrate-submission-memberships.ts"], { cwd: process.cwd(), env, encoding: "utf8", stdio: "pipe" })).toThrow();
  });
});
