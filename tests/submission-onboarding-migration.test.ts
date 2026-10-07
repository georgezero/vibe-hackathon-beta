import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("submission-first onboarding migration", () => {
  it("is additive, idempotent, and preserves existing submission data", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-c1-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE submissions (id TEXT PRIMARY KEY, edit_token TEXT NOT NULL);
      CREATE TABLE submission_owners (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), user_id TEXT NOT NULL REFERENCES users(id));
      INSERT INTO users VALUES ('user-1');
      INSERT INTO submissions VALUES ('sub_existing', 'edit_existing');
      INSERT INTO submission_owners VALUES ('owner-1', 'sub_existing', 'user-1');
    `);
    sqlite.close();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DB_FILE_NAME: database,
      VIBE_TEST_DATABASE_ROOT: root,
      DATABASE_URL: "",
      VIBE_C1_MIGRATION_CONFIRM: `MIGRATE SUBMISSION ONBOARDING DATABASE ${database}`,
    };
    const args = ["tsx", "scripts/migrate-submission-onboarding.ts"];
    const first = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    const second = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    expect(JSON.parse(first)).toMatchObject({ idempotent: true, foreignKeyCheck: "passed" });
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    const check = new Database(database, { readonly: true });
    expect(check.prepare("SELECT count(*) count FROM submissions").get()).toEqual({ count: 1 });
    expect(check.prepare("SELECT count(*) count FROM submission_owners").get()).toEqual({ count: 1 });
    expect(check.prepare("SELECT count(*) count FROM submission_claim_transactions").get()).toEqual({ count: 0 });
    expect(check.pragma("foreign_key_check")).toEqual([]);
    check.close();
  });
});
