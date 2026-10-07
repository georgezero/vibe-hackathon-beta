import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import Database from "better-sqlite3";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

describe("direct messaging migration", () => {
  it("is additive, idempotent, and creates no direct records", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-f2-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec("PRAGMA foreign_keys=ON; CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE submissions (id TEXT PRIMARY KEY);");
    sqlite.close();
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DB_FILE_NAME: database, VIBE_TEST_DATABASE_ROOT: root, DATABASE_URL: "", VIBE_F2_MIGRATION_CONFIRM: `MIGRATE DIRECT MESSAGING DATABASE ${database}` };
    const args = ["tsx", "scripts/migrate-direct-messaging.ts"];
    const first = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    const second = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    expect(JSON.parse(first)).toMatchObject({ idempotent: true, foreignKeyCheck: "passed", counts: { conversations: 0, messages: 0, blocks: 0, reports: 0 } });
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    const check = new Database(database, { readonly: true });
    expect(check.pragma("foreign_key_check")).toEqual([]);
    expect(check.prepare("SELECT count(*) count FROM direct_conversations").get()).toEqual({ count: 0 });
    expect(check.prepare("SELECT count(*) count FROM direct_messages").get()).toEqual({ count: 0 });
    check.close();
  }, 15_000);
});
