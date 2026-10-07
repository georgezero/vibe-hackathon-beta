import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyVibyIdentityRows,
  type VibyIdentityClassification,
} from "../lib/viby-interactive-linking";

const now = new Date("2026-07-29T20:00:00.000Z");
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "legacy-link",
    providerId: "viby",
    subjectId: "legacy-subject",
    role: "admin" as const,
    linkScope: "legacy_admin" as const,
    localUserId: null,
    applicationId: "vibe-hackathon",
    status: "active" as const,
    linkProvenance: "operator",
    environment: null,
    bindingProvenance: null,
    boundAt: null,
    displayName: "Legacy identity",
    lastVerifiedAt: now,
    lastAuthenticatedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
const classify = (rows: ReturnType<typeof row>[]): VibyIdentityClassification =>
  classifyVibyIdentityRows(rows, {
    subject: "legacy-subject",
    applicationId: "vibe-hackathon",
    environment: "https://vibe.example.test",
  });

function phaseADatabase(path: string) {
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
      id TEXT PRIMARY KEY, token TEXT UNIQUE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL, ip_address TEXT, user_agent TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE admin_authorizations (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active', grant_source TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, revoked_at INTEGER
    );
    CREATE TABLE viby_identity_links (
      id TEXT PRIMARY KEY, provider_id TEXT NOT NULL DEFAULT 'viby',
      subject_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin')),
      local_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      display_name TEXT NOT NULL, last_verified_at INTEGER NOT NULL,
      revoked_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX viby_identity_links_provider_subject_role_unique
      ON viby_identity_links(provider_id,subject_id,role);
    CREATE TABLE events(id TEXT PRIMARY KEY);
    CREATE TABLE submissions(id TEXT PRIMARY KEY);
  `);
  db.close();
}
function migrate(path: string) {
  execFileSync("npx", ["tsx", "scripts/migrate-viby-better-auth.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DB_FILE_NAME: path,
      VIBE_PHASE_B_MIGRATION_CONFIRM: `MIGRATE VIBY BETTER AUTH DATABASE ${path}`,
    },
  });
}

describe("unbound legacy Viby identity claims", () => {
  it("classifies only the recognized exact legacy state as claimable", () => {
    expect(classify([row()]).kind).toBe("unbound_legacy_claimable");
    expect(classify([]).kind).toBe("absent");
    expect(classify([row({ localUserId: "user-1" })]).kind).toBe("bound_active");
    expect(classify([row({ status: "revoked", revokedAt: now })]).kind).toBe("revoked");
    expect(classify([row(), row({ id: "duplicate" })]).kind).toBe("ambiguous");
    expect(classify([row({ applicationId: "other-app" })]).kind).toBe("conflict");
    expect(classify([row({ environment: "https://other.example.test" })]).kind).toBe("ambiguous");
    expect(classify([row({ subjectId: "other-subject" })]).kind).toBe("conflict");
    expect(classify([row({ linkProvenance: "unknown" })]).kind).toBe("ambiguous");
    expect(classify([row({ bindingProvenance: "transferred" })]).kind).toBe("ambiguous");
  });

  it("atomically claims the existing row, preserves history, and creates no authorization", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-legacy-claim-"));
    const path = join(dir, "app.db");
    phaseADatabase(path);
    migrate(path);
    const output = execFileSync("npx", ["tsx", "tests/helpers/viby-legacy-claim-smoke.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "test", DB_FILE_NAME: path },
      encoding: "utf8",
    });
    expect(JSON.parse(output.trim())).toEqual({
      firstConfirmed: true,
      sameRowUpdated: true,
      creationPreserved: true,
      bindingProvenance: "interactive_legacy_claim",
      boundUser: "claim-user-1",
      replayRejected: true,
      targetConflict: "user_conflict",
      cancelled: true,
      statusChanged: "revoked_link",
      ownerChanged: "subject_conflict",
      concurrentWinner: true,
      concurrentSameUserIdempotent: true,
      confirmedTransactions: 3,
      adminGrantsCreated: 0,
    });
  }, 30_000);

  it("reports only sanitized live-data qualification counts", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-link-inspect-"));
    const path = join(dir, "app.db");
    phaseADatabase(path);
    migrate(path);
    const db = new Database(path);
    const timestamp = Math.floor(now.getTime() / 1000);
    db.prepare(`
      INSERT INTO viby_identity_links
        (id,provider_id,subject_id,role,local_user_id,application_id,status,
         link_provenance,display_name,last_verified_at,created_at,updated_at)
      VALUES ('inspect-link','viby','private-subject','admin',NULL,'vibe-hackathon',
              'active','operator','Private label',?,?,?)
    `).run(timestamp, timestamp, timestamp);
    db.close();
    const output = execFileSync("npx", ["tsx", "scripts/inspect-viby-link-state.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DB_FILE_NAME: path,
        VIBE_LINK_ENVIRONMENT: "https://vibe.example.test",
      },
      encoding: "utf8",
    });
    const report = JSON.parse(output.trim());
    expect(report).toMatchObject({
      boundActive: 0,
      claimableUnboundLegacy: 1,
      revoked: 0,
      ambiguous: 0,
      conflictingUsers: 0,
      activeAdminGrants: 0,
    });
    expect(output).not.toContain("private-subject");
    expect(output).not.toContain("Private label");
  }, 30_000);
});
