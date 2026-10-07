import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("judging operations migration", () => {
  it("creates lifecycle projections idempotently without changing assignments", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-d1-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE judges (id TEXT PRIMARY KEY);
      CREATE TABLE submissions (id TEXT PRIMARY KEY);
      CREATE TABLE judge_assignments (id TEXT PRIMARY KEY, judge_id TEXT NOT NULL REFERENCES judges(id), submission_id TEXT NOT NULL REFERENCES submissions(id));
      CREATE TABLE human_scores (id TEXT PRIMARY KEY, judge_id TEXT NOT NULL, submission_id TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0, private_notes TEXT);
      INSERT INTO judges VALUES ('judge-a'); INSERT INTO submissions VALUES ('sub-a');
      INSERT INTO judge_assignments VALUES ('assignment-a','judge-a','sub-a');
      INSERT INTO human_scores VALUES ('score-a','judge-a','sub-a',1,0,0,NULL);
    `);
    sqlite.close();
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DB_FILE_NAME: database, DATABASE_URL: "", VIBE_TEST_DATABASE_ROOT: root, VIBE_D1_MIGRATION_CONFIRM: `MIGRATE JUDGING OPERATIONS DATABASE ${database}` };
    const args = ["tsx", "scripts/migrate-judging-operations.ts"];
    const first = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    const second = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    expect(JSON.parse(first)).toMatchObject({ idempotent: true, assignmentStates: 1, evaluationStates: 1 });
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    const check = new Database(database, { readonly: true });
    expect(check.prepare("SELECT status FROM judging_evaluation_states").get()).toEqual({ status: "submitted" });
    expect(check.prepare("SELECT count(*) count FROM judge_assignments").get()).toEqual({ count: 1 });
    expect(check.pragma("foreign_key_check")).toEqual([]);
    check.close();
  }, 15_000);
});
