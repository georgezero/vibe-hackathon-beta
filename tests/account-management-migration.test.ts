import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("account-management additive migration", () => {
  it("is idempotent, creates no users or policy rows, and preserves integrity", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-account-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE sessions (id TEXT PRIMARY KEY);
      CREATE TABLE accounts (id TEXT PRIMARY KEY);
      CREATE TABLE admin_authorizations (id TEXT PRIMARY KEY);
      CREATE TABLE judge_authorizations (id TEXT PRIMARY KEY);
      INSERT INTO users VALUES ('existing-user');
    `);
    sqlite.close();
    const confirmation = `MIGRATE ACCOUNT MANAGEMENT DATABASE ${database}`;
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DB_FILE_NAME: database,
      VIBE_TEST_DATABASE_ROOT: root,
      DATABASE_URL: "",
      VIBE_ACCOUNT_MANAGEMENT_MIGRATION_CONFIRM: confirmation,
    };
    const args = ["tsx", "scripts/migrate-account-management.ts"];
    const first = JSON.parse(execFileSync("npx", args, {
      cwd: process.cwd(),
      env: environment,
      encoding: "utf8",
    }));
    const second = JSON.parse(execFileSync("npx", args, {
      cwd: process.cwd(),
      env: environment,
      encoding: "utf8",
    }));
    expect(first).toMatchObject({
      accountControlsBefore: 0,
      accountControlsAfter: 0,
      automaticRowsCreated: 0,
      foreignKeyCheck: "passed",
    });
    expect(second).toEqual(first);

    const validation = new Database(database, { readonly: true });
    expect(validation.prepare("SELECT count(*) count FROM users").get())
      .toEqual({ count: 1 });
    expect(validation.prepare("SELECT count(*) count FROM user_account_controls").get())
      .toEqual({ count: 0 });
    expect(validation.pragma("foreign_key_check")).toEqual([]);
    const indexes = validation.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'user_account_controls_%' ORDER BY name",
    ).all();
    expect(indexes).toEqual([
      { name: "user_account_controls_password_change_idx" },
      { name: "user_account_controls_status_idx" },
    ]);
    validation.close();
  });
});
