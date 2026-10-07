import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("D.4 publication migration", () => {
  it("creates the release, award, feedback, and announcement boundary idempotently", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-d4-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE judges (id TEXT PRIMARY KEY);
      CREATE TABLE events (id TEXT PRIMARY KEY, winners_published_at INTEGER);
      CREATE TABLE submissions (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id));
      CREATE TABLE result_publication_states (event_id TEXT PRIMARY KEY, status TEXT NOT NULL, published_at INTEGER);
      CREATE TABLE result_winners (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), submission_id TEXT NOT NULL REFERENCES submissions(id), category TEXT NOT NULL, award_label TEXT, status TEXT NOT NULL, actor_user_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      INSERT INTO events VALUES ('event-a', NULL);
      INSERT INTO submissions VALUES ('sub-a', 'event-a');
      INSERT INTO result_publication_states VALUES ('event-a', 'reviewed', NULL);
    `);
    sqlite.close();
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DB_FILE_NAME: database, DATABASE_URL: "", VIBE_D4_MIGRATION_CONFIRM: `MIGRATE PUBLICATION DATABASE ${database}` };
    const args = ["tsx", "scripts/migrate-publication.ts"];
    const first = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    const second = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    expect(JSON.parse(first)).toMatchObject({ idempotent: true, releases: 1, qualificationReleases: 0, revisions: 1, qualificationRevisions: 0, qualificationAnnouncements: 0, awards: 0, feedback: 0, announcements: 0 });
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    const check = new Database(database, { readonly: true });
    expect(check.prepare("SELECT status, publication_mode, show_scores FROM publication_releases WHERE event_id = 'event-a'").get()).toEqual({ status: "calculated", publication_mode: "awards_only", show_scores: 1 });
    expect(check.pragma("foreign_key_check")).toEqual([]);
    expect(check.prepare("SELECT count(*) AS count FROM publication_awards").get()).toEqual({ count: 0 });
    expect(check.prepare("SELECT revision, status FROM publication_revisions WHERE release_id = 'pr_event-a'").get()).toEqual({ revision: 1, status: "calculated" });
    expect(check.prepare("SELECT count(*) AS count FROM publication_qualification_releases").get()).toEqual({ count: 0 });
    expect(check.prepare("SELECT count(*) AS count FROM publication_qualification_revisions").get()).toEqual({ count: 0 });
    expect(check.prepare("SELECT count(*) AS count FROM publication_qualification_announcements").get()).toEqual({ count: 0 });
    check.close();
  }, 15_000);
});
