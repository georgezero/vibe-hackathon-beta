import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

describe("user profile additive migration", () => {
  it("creates the private profile domain idempotently without backfill", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-user-profiles-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec("PRAGMA foreign_keys=ON; CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE); INSERT INTO users VALUES ('existing', 'Existing Person', 'existing@example.invalid');");
    sqlite.close();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DB_FILE_NAME: database,
      VIBE_TEST_DATABASE_ROOT: root,
      DATABASE_URL: "",
      VIBE_USER_PROFILES_MIGRATION_CONFIRM: `MIGRATE USER PROFILES DATABASE ${database}`,
    };
    const args = ["tsx", "scripts/migrate-user-profiles.ts"];
    const first = JSON.parse(execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" }));
    const second = JSON.parse(execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" }));
    expect(first).toEqual({ database, profiles: 0, automaticRowsCreated: 0, idempotent: true, foreignKeyCheck: "passed" });
    expect(second).toEqual(first);

    const validation = new Database(database, { readonly: true });
    expect(validation.prepare("SELECT count(*) AS count FROM users").get()).toEqual({ count: 1 });
    expect(validation.prepare("SELECT name FROM users WHERE id='existing'").get()).toEqual({ name: "Existing Person" });
    expect(validation.prepare("SELECT count(*) AS count FROM user_profiles").get()).toEqual({ count: 0 });
    expect((validation.prepare("PRAGMA table_info(user_profiles)").all() as Array<{ name: string }>).map((column) => column.name)).toContain("discoverable");
    expect(validation.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='user_profiles_discovery_idx'").get()).toEqual({ name: "user_profiles_discovery_idx" });
    expect(validation.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='user_profiles_handle_unique'").get()).toMatchObject({ sql: expect.stringContaining("WHERE handle IS NOT NULL") });
    expect(validation.pragma("foreign_key_check")).toEqual([]);
    expect(validation.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    validation.close();
  });

  it("adds discoverability to an existing F.0A table without changing profile rows", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-user-profiles-legacy-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE);
      INSERT INTO users VALUES ('existing', 'Existing Person', 'existing@example.invalid');
      CREATE TABLE user_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        handle TEXT, display_name TEXT, headline TEXT, bio TEXT, affiliation TEXT,
        degrees TEXT, website_url TEXT, github_url TEXT, linkedin_url TEXT,
        interests TEXT, visibility TEXT NOT NULL DEFAULT 'private', deactivated_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT user_profiles_visibility_check CHECK (visibility IN ('private', 'public')),
        CONSTRAINT user_profiles_display_name_length_check CHECK (display_name IS NULL OR length(trim(display_name)) BETWEEN 2 AND 100),
        CONSTRAINT user_profiles_handle_format_check CHECK (handle IS NULL OR (length(handle) BETWEEN 3 AND 30 AND handle NOT GLOB '*[^a-z0-9-]*' AND handle NOT GLOB '-*' AND handle NOT GLOB '*-' AND handle NOT LIKE '%--%')),
        CONSTRAINT user_profiles_headline_length_check CHECK (headline IS NULL OR length(headline) <= 160),
        CONSTRAINT user_profiles_bio_length_check CHECK (bio IS NULL OR length(bio) <= 2000),
        CONSTRAINT user_profiles_affiliation_length_check CHECK (affiliation IS NULL OR length(affiliation) <= 160),
        CONSTRAINT user_profiles_degrees_length_check CHECK (degrees IS NULL OR length(degrees) <= 120)
      );
      INSERT INTO user_profiles (id, user_id, display_name, visibility) VALUES ('profile-existing', 'existing', 'Existing Person', 'private');
      CREATE UNIQUE INDEX user_profiles_user_unique ON user_profiles(user_id);
      CREATE UNIQUE INDEX user_profiles_handle_unique ON user_profiles(handle) WHERE handle IS NOT NULL;
      CREATE INDEX user_profiles_visibility_idx ON user_profiles(visibility);
    `);
    sqlite.close();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DB_FILE_NAME: database,
      VIBE_TEST_DATABASE_ROOT: root,
      DATABASE_URL: "",
      VIBE_USER_PROFILES_MIGRATION_CONFIRM: `MIGRATE USER PROFILES DATABASE ${database}`,
    };
    execFileSync("npx", ["tsx", "scripts/migrate-user-profiles.ts"], { cwd: process.cwd(), env, encoding: "utf8" });
    const validation = new Database(database, { readonly: true });
    expect(validation.prepare("SELECT display_name, visibility, discoverable FROM user_profiles WHERE user_id='existing'").get()).toEqual({ display_name: "Existing Person", visibility: "private", discoverable: 0 });
    expect(validation.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='user_profiles_discovery_idx'").get()).toEqual({ name: "user_profiles_discovery_idx" });
    expect(validation.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
    validation.close();
  });
});
