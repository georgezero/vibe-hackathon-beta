import Database from "better-sqlite3";
import { execFileSync, spawnSync } from "child_process";
import { chmodSync, existsSync, mkdtempSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";

function legacyDatabase(path: string) {
  const db = new Database(path);
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0, image TEXT,
      github_id TEXT UNIQUE, github_username TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT, refresh_token TEXT, id_token TEXT,
      access_token_expires_at INTEGER, refresh_token_expires_at INTEGER,
      scope TEXT, password TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, token TEXT UNIQUE, user_id TEXT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE events (id TEXT PRIMARY KEY);
    CREATE TABLE submissions (id TEXT PRIMARY KEY);
  `);
  db.close();
}

function migration(databasePath: string, confirmation = `MIGRATE ADMIN AUTH DATABASE ${databasePath}`) {
  return spawnSync("npx", ["tsx", "scripts/migrate-admin-auth.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      DB_FILE_NAME: databasePath,
      VIBE_ADMIN_AUTH_MIGRATION_CONFIRM: confirmation,
    },
    encoding: "utf8",
  });
}

describe("admin authorization migration and provisioning", () => {
  it("migrates idempotently and provisions one explicit password admin", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-admin-auth-"));
    const databasePath = join(dir, "test.db");
    const passwordPath = join(dir, "password");
    legacyDatabase(databasePath);
    writeFileSync(passwordPath, "a-long-test-password-123\n", { mode: 0o600 });
    chmodSync(passwordPath, 0o600);
    const migrateEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DB_FILE_NAME: databasePath,
      VIBE_ADMIN_AUTH_MIGRATION_CONFIRM: `MIGRATE ADMIN AUTH DATABASE ${databasePath}`,
    };
    execFileSync("npx", ["tsx", "scripts/migrate-admin-auth.ts"], { cwd: process.cwd(), env: migrateEnv });
    execFileSync("npx", ["tsx", "scripts/migrate-admin-auth.ts"], { cwd: process.cwd(), env: migrateEnv });
    const provisionEnv = {
      ...process.env,
      DB_FILE_NAME: databasePath,
      VIBE_ADMIN_PROVISION_CONFIRM: `PROVISION_PASSWORD_ADMIN:${databasePath}:admin@example.test`,
    };
    const args = [
      "tsx", "scripts/provision-password-admin.ts",
      "--email", "admin@example.test",
      "--name", "Test Admin",
      "--password-file", passwordPath,
    ];
    execFileSync("npx", args, { cwd: process.cwd(), env: provisionEnv });
    execFileSync("npx", args, { cwd: process.cwd(), env: provisionEnv });
    const authOutput = execFileSync("npx", ["tsx", "tests/helpers/admin-password-auth-smoke.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        DB_FILE_NAME: databasePath,
        BETTER_AUTH_SECRET: "test-better-auth-secret-that-is-at-least-32-characters",
        BETTER_AUTH_URL: "http://127.0.0.1:3000",
        VIBE_HACKATHON_BASE_URL: "http://127.0.0.1:3000",
        VIBE_ADMIN_SESSION_SECRET: "test-viby-admin-session-secret-that-is-long-enough",
        VIBE_ADMIN_VIBY_USER_IDS: "test-viby-admin",
      },
      encoding: "utf8",
    });
    expect(JSON.parse(authOutput.trim())).toMatchObject({
      invalidStatus: 401,
      validStatus: 200,
      hasCookie: true,
      sessionUser: "admin@example.test",
      authorizedStatus: "authorized",
      authorizedIdentityMethod: "better_auth_session",
      conflictStatus: "authorized",
      conflictReason: null,
      revokedStatus: "forbidden",
      signOutStatus: 200,
      clearsCookie: true,
      sessionsBeforeSignOut: 1,
      sessionsAfterSignOut: 0,
      sessionAfterSignOut: true,
    });
    const db = new Database(databasePath, { readonly: true });
    expect(db.prepare("SELECT count(*) AS count FROM users").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT count(*) AS count FROM accounts WHERE provider_id='credential'").get()).toEqual({ count: 1 });
    expect(db.prepare("SELECT count(*) AS count FROM admin_authorizations WHERE status='active'").get()).toEqual({ count: 1 });
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%admin_authorizations%' OR name='accounts_credential_user_unique'",
    ).all() as Array<{ name: string }>;
    expect(indexes.map((row) => row.name)).toEqual(expect.arrayContaining([
      "admin_authorizations_user_unique",
      "admin_authorizations_status_idx",
      "accounts_credential_user_unique",
    ]));
    const password = (db.prepare("SELECT password FROM accounts").get() as { password: string }).password;
    expect(password).not.toContain("a-long-test-password");
    db.close();
  }, 30_000);

  it("refuses invalid filesystem targets before SQLite can create or open them", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-admin-auth-target-"));
    const missing = join(dir, "missing.db");
    const missingResult = migration(missing);
    expect(missingResult.status).not.toBe(0);
    expect(existsSync(missing)).toBe(false);

    expect(migration("relative.db").status).not.toBe(0);
    expect(migration(dir).status).not.toBe(0);

    const valid = join(dir, "valid.db");
    legacyDatabase(valid);
    const link = join(dir, "linked.db");
    symlinkSync(valid, link);
    expect(migration(link).status).not.toBe(0);
    const fifo = join(dir, "database.fifo");
    execFileSync("mkfifo", [fifo]);
    expect(migration(fifo).status).not.toBe(0);
    chmodSync(valid, 0o400);
    expect(migration(valid).status).not.toBe(0);
    chmodSync(valid, 0o600);
    const db = new Database(valid, { readonly: true });
    expect(db.prepare(
      "SELECT count(*) AS count FROM sqlite_master WHERE name='admin_authorizations'",
    ).get()).toEqual({ count: 0 });
    db.close();
  }, 30_000);

  it("refuses the protected backup path before inspecting it", () => {
    const protectedPath = join(process.cwd(), "local.db.pre-p0-4.bak");
    const result = migration(protectedPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("protected pre-P0.4 backup");
  }, 30_000);

  it("rejects confirmation and application-schema mismatches without mutation", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-admin-auth-identity-"));
    const databasePath = join(dir, "test.db");
    legacyDatabase(databasePath);
    expect(migration(databasePath, "yes").status).not.toBe(0);

    const unrelated = join(dir, "unrelated.db");
    const db = new Database(unrelated);
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");
    db.close();
    const result = migration(unrelated);
    expect(result.status).not.toBe(0);
    const check = new Database(unrelated, { readonly: true });
    expect(check.prepare(
      "SELECT count(*) AS count FROM sqlite_master WHERE name='admin_authorizations'",
    ).get()).toEqual({ count: 0 });
    check.close();
  }, 30_000);

  it("rejects an incompatible existing authorization table without repairing it", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-admin-auth-incompatible-"));
    const databasePath = join(dir, "test.db");
    legacyDatabase(databasePath);
    const db = new Database(databasePath);
    db.exec("CREATE TABLE admin_authorizations (id TEXT PRIMARY KEY, unexpected TEXT)");
    db.close();
    const result = migration(databasePath);
    expect(result.status).not.toBe(0);
    const check = new Database(databasePath, { readonly: true });
    const columns = check.prepare("PRAGMA table_info(admin_authorizations)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(["id", "unexpected"]);
    expect(check.prepare(
      "SELECT count(*) AS count FROM sqlite_master WHERE type='index' AND name='accounts_credential_user_unique'",
    ).get()).toEqual({ count: 0 });
    check.close();
  }, 30_000);

  it("rolls back all new schema when duplicate credentials prevent migration", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-admin-auth-rollback-"));
    const databasePath = join(dir, "test.db");
    legacyDatabase(databasePath);
    const db = new Database(databasePath);
    db.exec(`
      INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
      VALUES ('user-1', 'User', 'user@example.test', 1, 1, 1);
      INSERT INTO accounts (id, account_id, provider_id, user_id, created_at, updated_at)
      VALUES ('account-1', 'user-1', 'credential', 'user-1', 1, 1);
      INSERT INTO accounts (id, account_id, provider_id, user_id, created_at, updated_at)
      VALUES ('account-2', 'user-1', 'credential', 'user-1', 1, 1);
    `);
    db.close();
    expect(migration(databasePath).status).not.toBe(0);
    const check = new Database(databasePath, { readonly: true });
    expect(check.prepare(
      "SELECT count(*) AS count FROM sqlite_master WHERE name='admin_authorizations'",
    ).get()).toEqual({ count: 0 });
    check.close();
  }, 30_000);
});
