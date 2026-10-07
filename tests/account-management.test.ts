import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  isRecentAdministratorAuthentication,
} from "@/lib/account-management";

function fixtureDatabase(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      github_id TEXT UNIQUE,
      github_username TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY NOT NULL,
      token TEXT UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX accounts_credential_user_unique
      ON accounts(user_id) WHERE provider_id='credential';
    CREATE TABLE user_account_controls (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active',
      password_change_required INTEGER NOT NULL DEFAULT 0,
      temporary_password_issued_at INTEGER,
      password_changed_at INTEGER,
      disabled_at INTEGER,
      disabled_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      CHECK (status IN ('active','disabled')),
      CHECK ((status='active' AND disabled_at IS NULL) OR (status='disabled' AND disabled_at IS NOT NULL))
    );
    CREATE TABLE admin_authorizations (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      grant_source TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE UNIQUE INDEX admin_authorizations_user_unique ON admin_authorizations(user_id);
    CREATE TABLE events (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 0,
      is_frozen INTEGER NOT NULL DEFAULT 0,
      audience_voting_enabled INTEGER NOT NULL DEFAULT 1,
      audience_award_count INTEGER NOT NULL DEFAULT 1,
      audience_votes_per_person INTEGER NOT NULL DEFAULT 1,
      audience_results_visible INTEGER NOT NULL DEFAULT 1,
      audience_voting_mode TEXT NOT NULL DEFAULT 'disabled',
      audience_identity_method TEXT NOT NULL DEFAULT 'anonymous',
      show_judge_choice INTEGER NOT NULL DEFAULT 1,
      show_peoples_choice INTEGER NOT NULL DEFAULT 1,
      show_a_i_choice INTEGER NOT NULL DEFAULT 1,
      show_special_awards INTEGER NOT NULL DEFAULT 1,
      llm_judging_enabled INTEGER NOT NULL DEFAULT 0,
      llm_judging_affects_official_score INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE judges (
      id TEXT PRIMARY KEY NOT NULL,
      token TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE judge_authorizations (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE RESTRICT,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
      status TEXT NOT NULL,
      grant_provenance TEXT NOT NULL,
      granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      invited_at INTEGER,
      accepted_at INTEGER,
      revoked_at INTEGER,
      revocation_reason TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX judge_authorizations_active_user_event_unique
      ON judge_authorizations(user_id,event_id) WHERE status='active';
    CREATE UNIQUE INDEX judge_authorizations_active_judge_event_unique
      ON judge_authorizations(judge_id,event_id) WHERE status='active';
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_type TEXT,
      actor_id TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );
    INSERT INTO users
      (id,name,email,email_verified,created_at,updated_at)
      VALUES ('operator-user','Operator','operator@example.test',1,1,1);
    INSERT INTO admin_authorizations
      (id,user_id,status,grant_source,created_at,updated_at)
      VALUES ('admin-auth','operator-user','active','fixture',1,1);
    INSERT INTO events
      (id,name,slug,is_active,created_at,updated_at)
      VALUES ('event-current','Current Event','current-event',1,1,1);
    INSERT INTO judges
      (id,token,name,email,created_at)
      VALUES ('judge-profile-1','fixture-token','Judge Profile','judge@example.test',1);
  `);
  sqlite.close();
}

describe("account-management lifecycle", () => {
  it("derives password credential state on the server", () => {
    const route = readFileSync("app/api/account/password/route.ts", "utf8");
    expect(route).toContain("eq(accounts.userId, authenticated.principal.user.id)");
    expect(route).toContain('eq(accounts.providerId, "credential")');
    expect(route).not.toContain("body.hasPassword");
  });

  it("generates strong non-retrievable temporary password material", () => {
    const first = generateTemporaryPassword();
    const second = generateTemporaryPassword();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(24);
    expect(first).toMatch(/[A-Z]/);
    expect(first).toMatch(/[a-z]/);
    expect(first).toMatch(/[0-9]/);
    expect(first).toMatch(/[^A-Za-z0-9]/);
  });

  it("requires recent administrator authentication", () => {
    const now = new Date();
    expect(isRecentAdministratorAuthentication(new Date(now.getTime() - 60_000), now)).toBe(true);
    expect(isRecentAdministratorAuthentication(new Date(now.getTime() - 11 * 60_000), now)).toBe(false);
    expect(isRecentAdministratorAuthentication(new Date(now.getTime() + 1_000), now)).toBe(false);
  });

  it("provisions, grants, revokes, resets, protects self, and audits without secrets", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-account-management-"));
    const database = join(root, "application.db");
    fixtureDatabase(database);
    const result = JSON.parse(execFileSync(
      process.execPath,
      ["--import", "tsx", "tests/helpers/account-management-smoke.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "test",
          DB_FILE_NAME: database,
          VIBE_TEST_DATABASE_ROOT: root,
          DATABASE_URL: "",
        },
        encoding: "utf8",
      },
    ));
    expect(result).toMatchObject({
      createdPasswordValid: true,
      resetPasswordValid: true,
      temporaryPasswordsDiffer: true,
      lastAdministratorProtected: true,
      selfDisableProtected: true,
      revokedSessions: 1,
      auditContainsPassword: false,
    });
    expect(result.auditCount).toBeGreaterThanOrEqual(8);

    const sqlite = new Database(database, { readonly: true });
    expect(sqlite.prepare("SELECT status,password_change_required required FROM user_account_controls WHERE user_id != 'operator-user'").get())
      .toEqual({ status: "disabled", required: 1 });
    expect(sqlite.prepare("SELECT count(*) count FROM sessions WHERE user_id != 'operator-user'").get())
      .toEqual({ count: 0 });
    expect(sqlite.prepare("SELECT count(*) count FROM judge_authorizations WHERE status='active'").get())
      .toEqual({ count: 0 });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    sqlite.close();
  });
});
