import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("native chat migration", () => {
  it("is additive and idempotent on a disposable database", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-c2b-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE submissions (id TEXT PRIMARY KEY);
      INSERT INTO users VALUES ('user-1');
      INSERT INTO submissions VALUES ('sub-existing');
    `);
    sqlite.close();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DB_FILE_NAME: database,
      VIBE_TEST_DATABASE_ROOT: root,
      DATABASE_URL: "",
      VIBE_C2B_MIGRATION_CONFIRM: `MIGRATE NATIVE CHAT DATABASE ${database}`,
    };
    const args = ["tsx", "scripts/migrate-native-chat.ts"];
    const first = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    const second = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    expect(JSON.parse(first)).toMatchObject({ idempotent: true, foreignKeyCheck: "passed" });
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    const check = new Database(database, { readonly: true });
    expect(check.prepare("SELECT count(*) count FROM chat_rooms").get()).toEqual({ count: 0 });
    expect(check.prepare("SELECT count(*) count FROM chat_messages").get()).toEqual({ count: 0 });
    expect(check.pragma("foreign_key_check")).toEqual([]);
    check.close();
  }, 15_000);
});
