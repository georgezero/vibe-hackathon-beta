import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

function fixture(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, email_verified INTEGER NOT NULL DEFAULT 0, image TEXT, github_id TEXT UNIQUE, github_username TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, token TEXT UNIQUE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE accounts (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, access_token TEXT, refresh_token TEXT, id_token TEXT, access_token_expires_at INTEGER, refresh_token_expires_at INTEGER, scope TEXT, password TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE UNIQUE INDEX accounts_credential_user_unique ON accounts(user_id) WHERE provider_id='credential';
    CREATE TABLE user_account_controls (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL, password_change_required INTEGER NOT NULL, temporary_password_issued_at INTEGER, password_changed_at INTEGER, disabled_at INTEGER, disabled_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE admin_authorizations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL, grant_source TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, revoked_at INTEGER);
    CREATE UNIQUE INDEX admin_authorizations_user_unique ON admin_authorizations(user_id);
    CREATE TABLE events (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL DEFAULT 0, is_frozen INTEGER NOT NULL DEFAULT 0, audience_voting_enabled INTEGER NOT NULL DEFAULT 1, audience_award_count INTEGER NOT NULL DEFAULT 1, audience_votes_per_person INTEGER NOT NULL DEFAULT 1, audience_results_visible INTEGER NOT NULL DEFAULT 1, audience_voting_mode TEXT NOT NULL DEFAULT 'disabled', audience_identity_method TEXT NOT NULL DEFAULT 'anonymous', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE judges (id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE judge_authorizations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT, judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE RESTRICT, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT, status TEXT NOT NULL, grant_provenance TEXT NOT NULL, granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, invited_at INTEGER, accepted_at INTEGER, revoked_at INTEGER, revocation_reason TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE UNIQUE INDEX judge_authorizations_active_user_event_unique ON judge_authorizations(user_id,event_id) WHERE status='active';
    CREATE UNIQUE INDEX judge_authorizations_active_judge_event_unique ON judge_authorizations(judge_id,event_id) WHERE status='active';
    CREATE TABLE audit_events (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, actor_type TEXT, actor_id TEXT, metadata TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE viby_login_transactions (id TEXT PRIMARY KEY);
    CREATE TABLE viby_identity_link_transactions (id TEXT PRIMARY KEY);
    INSERT INTO users VALUES ('operator-user','Operator','operator@example.test',1,NULL,NULL,NULL,1,1);
    INSERT INTO admin_authorizations VALUES ('admin-auth','operator-user','active','fixture',1,1,NULL);
    INSERT INTO events VALUES ('event-current','Current Event','current',1,0,1,1,1,1,'disabled','anonymous',1,1);
    INSERT INTO judges VALUES ('judge-profile-1','redacted-fixture','Judge Profile','judge@example.test',1);
  `);
  sqlite.close();
}

describe("account invitations", () => {
  it("migrates idempotently and preserves existing rows", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-invitation-migration-"));
    const database = join(root, "application.db");
    fixture(database);
    const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DB_FILE_NAME: database, VIBE_TEST_DATABASE_ROOT: root, DATABASE_URL: "", VIBE_ACCOUNT_INVITATIONS_MIGRATION_CONFIRM: `MIGRATE ACCOUNT INVITATIONS DATABASE ${database}` };
    const args = ["tsx", "scripts/migrate-account-invitations.ts"];
    const first = JSON.parse(execFileSync("npx", args, { cwd: process.cwd(), env: environment, encoding: "utf8" }));
    const second = JSON.parse(execFileSync("npx", args, { cwd: process.cwd(), env: environment, encoding: "utf8" }));
    expect(first).toMatchObject({ invitationsBefore: 0, invitationsAfter: 0, automaticRowsCreated: 0, foreignKeyCheck: "passed" });
    expect(second).toEqual(first);
    const sqlite = new Database(database, { readonly: true });
    expect(sqlite.prepare("SELECT count(*) count FROM users").get()).toEqual({ count: 1 });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    sqlite.close();
  });

  it("keeps secrets hashed and applies server-owned access only on acceptance", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-invitation-flow-"));
    const database = join(root, "application.db");
    fixture(database);
    const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DB_FILE_NAME: database, VIBE_TEST_DATABASE_ROOT: root, DATABASE_URL: "", VIBE_ACCOUNT_INVITATIONS_MIGRATION_CONFIRM: `MIGRATE ACCOUNT INVITATIONS DATABASE ${database}` };
    execFileSync("npx", ["tsx", "scripts/migrate-account-invitations.ts"], { cwd: process.cwd(), env: environment });
    const result = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "tests/helpers/account-invitation-smoke.ts"], { cwd: process.cwd(), env: environment, encoding: "utf8" }));
    expect(result).toMatchObject({ beforeStatus: "pending", afterStatus: "accepted", credentialCount: 1, adminCount: 1, judgeCount: 1, oldTokenInvalidated: true, newTokenStatus: "pending", tokenStored: false, auditContainsSecret: false, userCount: 3 });
  });

  it("uses the registered Runtime contract and server-owned invitation mapping", () => {
    const start = readFileSync("app/api/invitations/accept/viby/route.ts", "utf8");
    const callback = readFileSync("lib/viby-unified-callback.ts", "utf8");
    expect(start).toContain("VIBY_RUNTIME_CALLBACK_PATH");
    expect(start).toContain("VIBY_RUNTIME_SOURCE");
    expect(start).toContain("forceIdentityCheck: true");
    expect(callback).toContain("invitationForLoginTransaction(transaction.id)");
    expect(callback).not.toContain("invitationEmail");
  });

  it("removes the production Viby diagnostic action", () => {
    expect(readFileSync("app/admin/page.tsx", "utf8")).not.toContain("Open Viby Identity in New Tab");
  });
});
