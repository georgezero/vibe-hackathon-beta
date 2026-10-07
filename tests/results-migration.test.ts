import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("D.2 results migration", () => {
  it("creates additive review and publication tables idempotently", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-d2-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE events (id TEXT PRIMARY KEY, winners_published_at INTEGER);
      CREATE TABLE submissions (id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id));
      INSERT INTO users VALUES ('admin');
      INSERT INTO events (id, winners_published_at) VALUES ('event-a', NULL);
      INSERT INTO submissions VALUES ('sub-a','event-a');
    `);
    sqlite.close();
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DB_FILE_NAME: database, DATABASE_URL: "", VIBE_TEST_DATABASE_ROOT: root, VIBE_D2_MIGRATION_CONFIRM: `MIGRATE RESULTS DATABASE ${database}` };
    const args = ["tsx", "scripts/migrate-results.ts"];
    const first = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    const second = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    expect(JSON.parse(first)).toMatchObject({ idempotent: true, tieReviews: 0, finalists: 0, winners: 0, publicationStates: 1 });
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    const check = new Database(database, { readonly: true });
    expect(check.prepare("SELECT status FROM result_publication_states WHERE event_id = 'event-a'").get()).toEqual({ status: "calculated" });
    expect(check.pragma("foreign_key_check")).toEqual([]);
    check.close();
  }, 15_000);
});
