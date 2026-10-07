import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function legacyPhaseB(path: string) {
  const db = new Database(path);
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE sessions (id TEXT PRIMARY KEY);
    CREATE TABLE viby_identity_links (
      id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, subject_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin')), local_user_id TEXT,
      application_id TEXT NOT NULL, status TEXT NOT NULL,
      link_provenance TEXT NOT NULL, environment TEXT,
      binding_provenance TEXT, bound_at INTEGER, display_name TEXT NOT NULL,
      last_verified_at INTEGER NOT NULL, last_authenticated_at INTEGER,
      revoked_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE viby_login_transactions (
      id TEXT PRIMARY KEY, state_hash TEXT NOT NULL UNIQUE,
      browser_binding_hash TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation = 'admin_login'),
      return_to TEXT NOT NULL, expected_audience TEXT NOT NULL,
      freshness_required INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      consumed_at INTEGER, failure_code TEXT
    );
    CREATE INDEX viby_login_transactions_expires_idx
      ON viby_login_transactions(expires_at);
    CREATE TABLE viby_session_handoffs (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      transaction_id TEXT NOT NULL REFERENCES viby_login_transactions(id) ON DELETE CASCADE,
      identity_link_id TEXT NOT NULL REFERENCES viby_identity_links(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viby_subject_hash TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation = 'admin_login'),
      return_to TEXT NOT NULL, created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL, consumed_at INTEGER
    );
    CREATE INDEX viby_session_handoffs_expires_idx
      ON viby_session_handoffs(expires_at);
    CREATE TABLE admin_session_provenance (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE,
      authentication_method TEXT NOT NULL,
      identity_link_id TEXT NOT NULL, viby_subject_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE viby_identity_link_transactions (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      browser_binding_hash TEXT NOT NULL, viby_subject TEXT NOT NULL,
      viby_subject_hash TEXT NOT NULL, application_id TEXT NOT NULL,
      environment TEXT NOT NULL, identity_session_id TEXT NOT NULL,
      verified_at INTEGER NOT NULL, assertion_correlation_hash TEXT NOT NULL,
      expected_user_id TEXT, return_to TEXT NOT NULL,
      transaction_type TEXT NOT NULL, status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL, created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL, consumed_at INTEGER, cancelled_at INTEGER,
      failure_code TEXT
    );
    INSERT INTO users VALUES ('user');
    INSERT INTO viby_identity_links VALUES (
      'link','viby','subject','admin','user','vibe-hackathon','active',
      'operator','https://app.example',NULL,NULL,'Historical',1,NULL,NULL,1,1
    );
    INSERT INTO viby_login_transactions VALUES (
      'tx','state','browser','admin_login','/admin/dashboard',
      'vibe-hackathon',1,1,2,1,NULL
    );
    INSERT INTO viby_session_handoffs VALUES (
      'handoff','token','tx','link','user','digest','admin_login',
      '/admin/dashboard',1,2,1
    );
  `);
  db.close();
}

function migrate(path: string) {
  return execFileSync("npx", ["tsx", "scripts/migrate-viby-judge-login.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DB_FILE_NAME: path,
      VIBE_PHASE_B44_MIGRATION_CONFIRM:
        `MIGRATE VIBY JUDGE LOGIN DATABASE ${path}`,
    },
    encoding: "utf8",
  });
}

describe("B.4.4 migration", () => {
  it("upgrades a live-shape Phase B operation model idempotently", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-b44-migration-"));
    const path = join(dir, "app.db");
    legacyPhaseB(path);
    expect(migrate(path)).toContain("schema is valid");
    expect(migrate(path)).toContain("schema is valid");

    const db = new Database(path);
    db.pragma("foreign_keys = ON");
    const sql = String((db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='viby_login_transactions'",
    ).get() as { sql: string }).sql).replace(/\s+/g, " ").toLowerCase();
    expect(sql).toContain("operation in ('admin_login', 'judge_login')");
    expect(db.prepare("SELECT operation FROM viby_login_transactions").all())
      .toEqual([{ operation: "admin_login" }]);
    expect(db.prepare("SELECT operation,verification_kind,verified_at FROM viby_session_handoffs").all())
      .toEqual([{
        operation: "admin_login",
        verification_kind: null,
        verified_at: null,
      }]);
    expect(db.prepare("SELECT link_scope FROM viby_identity_links").all())
      .toEqual([{ link_scope: "legacy_admin" }]);
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(() => db.prepare(`
      INSERT INTO viby_login_transactions
        (id,state_hash,browser_binding_hash,operation,return_to,expected_audience,
         freshness_required,created_at,expires_at)
      VALUES ('judge-tx','judge-state','judge-browser','judge_login',
              '/judge/dashboard','vibe-hackathon',0,1,2)
    `).run()).not.toThrow();
    expect(() => db.prepare(`
      INSERT INTO viby_login_transactions
        (id,state_hash,browser_binding_hash,operation,return_to,expected_audience,
         freshness_required,created_at,expires_at)
      VALUES ('bad-tx','bad-state','bad-browser','arbitrary',
              '/','vibe-hackathon',0,1,2)
    `).run()).toThrow();
    db.close();
  }, 30_000);
});
