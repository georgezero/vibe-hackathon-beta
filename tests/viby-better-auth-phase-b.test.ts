import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertVibyBetterAuthCompatibility } from "../lib/auth/viby-authentication-plugin";

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
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
      grant_source TEXT NOT NULL DEFAULT 'operator',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, revoked_at INTEGER
    );
    CREATE TABLE viby_identity_links (
      id TEXT PRIMARY KEY NOT NULL,
      provider_id TEXT NOT NULL DEFAULT 'viby',
      subject_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin')),
      local_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      display_name TEXT NOT NULL, last_verified_at INTEGER NOT NULL,
      revoked_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX viby_identity_links_provider_subject_role_unique
      ON viby_identity_links(provider_id, subject_id, role);
    CREATE TABLE events (id TEXT PRIMARY KEY);
    CREATE TABLE submissions (id TEXT PRIMARY KEY);
  `);
  db.close();
}

function migrate(path: string) {
  return execFileSync("npx", ["tsx", "scripts/migrate-viby-better-auth.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DB_FILE_NAME: path,
      VIBE_PHASE_B_MIGRATION_CONFIRM: `MIGRATE VIBY BETTER AUTH DATABASE ${path}`,
    },
    encoding: "utf8",
  });
}

describe("Phase B migration and Better Auth compatibility boundary", () => {
  it("fails at initialization when the pinned Better Auth contract changes", () => {
    const adapter = {
      createSession() {},
      findUserById() {},
      deleteSession() {},
    };
    expect(() => assertVibyBetterAuthCompatibility(
      { internalAdapter: adapter },
      "1.6.26",
    )).toThrow(/requires Better Auth 1\.6\.25/);
    expect(() => assertVibyBetterAuthCompatibility(
      { internalAdapter: { ...adapter, createSession: undefined } },
      "1.6.25",
    )).toThrow(/createSession is unavailable/);
    expect(() => assertVibyBetterAuthCompatibility(
      { internalAdapter: adapter },
      "1.6.25",
      null,
    )).toThrow(/setSessionCookie is unavailable/);
  });
  it("pins Better Auth and contains the internal seam in one plugin", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["better-auth"]).toBe("1.6.25");
    expect(pkg.dependencies["@better-auth/drizzle-adapter"]).toBe("1.6.25");
    const installed = JSON.parse(
      readFileSync("node_modules/better-auth/package.json", "utf8"),
    ) as { version: string };
    expect(installed.version).toBe("1.6.25");
    const plugin = readFileSync("lib/auth/viby-authentication-plugin.ts", "utf8");
    expect(plugin).toContain("ctx.context.internalAdapter.createSession");
    expect(plugin).toContain("setSessionCookie(ctx");
    const otherSource = [
      readFileSync("app/admin/viby/callback/route.ts", "utf8"),
      readFileSync("lib/viby-login-transactions.ts", "utf8"),
    ].join("\n");
    expect(otherSource).not.toContain("internalAdapter.createSession");
  });

  it("migrates idempotently and creates a normal, revocable Better Auth session", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-phase-b-"));
    const path = join(dir, "app.db");
    phaseADatabase(path);
    expect(migrate(path)).toContain("schema is valid");
    expect(migrate(path)).toContain("schema is valid");

    const handoff = "test-handoff-token-with-at-least-32-bytes";
    const now = Math.floor(Date.now() / 1000);
    const db = new Database(path);
    db.exec("PRAGMA foreign_keys=ON");
    db.prepare("INSERT INTO users VALUES (?, ?, ?, 1, NULL, NULL, NULL, ?, ?)")
      .run("user-1", "Phase B Admin", "phase-b@example.test", now, now);
    db.prepare("INSERT INTO admin_authorizations VALUES (?, ?, 'active', 'operator', ?, ?, NULL)")
      .run("grant-1", "user-1", now, now);
    db.prepare(`
      INSERT INTO viby_identity_links
        (id, provider_id, subject_id, role, local_user_id, application_id, status,
         link_provenance, display_name, last_verified_at, created_at, updated_at)
      VALUES ('link-1', 'viby', 'viby-subject-1', 'admin', 'user-1', 'vibe-hackathon',
              'active', 'operator', 'Phase B Admin', ?, ?, ?)
    `).run(now, now, now);
    db.prepare(`
      INSERT INTO viby_login_transactions
        (id, state_hash, browser_binding_hash, operation, return_to, expected_audience,
         freshness_required, created_at, expires_at, consumed_at)
      VALUES ('tx-1', 'state-hash', 'browser-hash', 'admin_login', '/admin/dashboard',
              'vibe-hackathon', 1, ?, ?, ?)
    `).run(now, now + 600, now);
    db.prepare(`
      INSERT INTO viby_session_handoffs
        (id, token_hash, transaction_id, identity_link_id, user_id, viby_subject_hash,
         operation, return_to, verification_kind, verified_at, created_at, expires_at)
      VALUES ('handoff-1', ?, 'tx-1', 'link-1', 'user-1', ?, 'admin_login',
              '/admin/dashboard', 'fresh', ?, ?, ?)
    `).run(
      createHash("sha256").update(handoff).digest("hex"),
      createHash("sha256").update("viby-subject-1").digest("hex"),
      now,
      now,
      now + 60,
    );
    db.close();

    const output = execFileSync("npx", ["tsx", "tests/helpers/viby-better-auth-smoke.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        DB_FILE_NAME: path,
        BETTER_AUTH_SECRET: "phase-b-test-secret-that-is-at-least-32-characters",
        BETTER_AUTH_URL: "http://127.0.0.1:3000",
        VIBE_HACKATHON_BASE_URL: "http://127.0.0.1:3000",
        VIBE_ADMIN_SESSION_SECRET: "phase-b-legacy-secret-at-least-32-characters",
        TEST_VIBY_HANDOFF: handoff,
      },
      encoding: "utf8",
    });
    expect(JSON.parse(output.trim())).toMatchObject({
      completeStatus: 302,
      location: "/admin/dashboard",
      hasBetterAuthCookie: true,
      clearsLegacyCookie: true,
      sessionUserId: "user-1",
      principalStatus: "authorized",
      identityMethod: "better_auth_viby",
      provenanceCountBeforeLogout: 1,
      sessionIpAddress: "192.0.2.10",
      sessionUserAgent: "vibe-phase-b-compatibility-test",
      revokedLinkStatus: "forbidden",
      signOutStatus: 200,
      signOutClearsCookie: true,
    });
    const verified = new Database(path, { readonly: true });
    expect(verified.prepare("SELECT count(*) count FROM admin_session_provenance").get()).toEqual({ count: 0 });
    expect(verified.prepare("SELECT count(*) count FROM sessions").get()).toEqual({ count: 0 });
    expect(verified.prepare("SELECT count(*) count FROM viby_session_handoffs WHERE consumed_at IS NOT NULL").get())
      .toEqual({ count: 1 });
    verified.close();
  }, 30_000);

  it("binds callback state and consumes it exactly once", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-phase-b-state-"));
    const path = join(dir, "app.db");
    phaseADatabase(path);
    migrate(path);
    const output = execFileSync("npx", ["tsx", "tests/helpers/viby-transaction-smoke.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        DB_FILE_NAME: path,
      },
      encoding: "utf8",
    });
    expect(JSON.parse(output.trim())).toMatchObject({
      stateLength: 43,
      safeReturn: "/admin/dashboard",
      explicitSafeReturn: "/admin/dashboard?tab=overview",
      wrongAccepted: false,
      consumed: true,
      replayAccepted: false,
    });
  }, 30_000);

  it("links interactively only after account authentication and never grants admin", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-phase-b2-link-"));
    const path = join(dir, "app.db");
    phaseADatabase(path);
    migrate(path);
    const output = execFileSync("npx", ["tsx", "tests/helpers/viby-interactive-link-smoke.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "test", DB_FILE_NAME: path },
      encoding: "utf8",
    });
    expect(JSON.parse(output.trim())).toEqual({
      mismatch: true,
      preparedUser: "user-1",
      accountChanged: false,
      confirmed: true,
      replay: false,
      idempotent: true,
      userConflict: "user_conflict",
      revoked: "revoked_link",
      cancelled: true,
      expired: true,
      adminGrantsCreated: 0,
    });
  }, 30_000);

  it("links explicitly, is idempotent, refuses conflicts, and revokes without reactivation", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibe-phase-b-link-"));
    const path = join(dir, "app.db");
    phaseADatabase(path);
    migrate(path);
    const now = Math.floor(Date.now() / 1000);
    const db = new Database(path);
    db.prepare("INSERT INTO users VALUES (?, ?, ?, 1, NULL, NULL, NULL, ?, ?)")
      .run("user-1", "One", "one@example.test", now, now);
    db.prepare("INSERT INTO users VALUES (?, ?, ?, 1, NULL, NULL, NULL, ?, ?)")
      .run("user-2", "Two", "two@example.test", now, now);
    db.close();
    const run = (action: "link" | "revoke", userId?: string) => execFileSync(
      "npx",
      [
        "tsx", "scripts/manage-viby-admin-link.ts",
        "--action", action,
        "--subject", "viby-subject-1",
        ...(userId ? ["--user-id", userId] : []),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DB_FILE_NAME: path,
          VIBE_IDENTITY_LINK_CONFIRM: `${action === "link" ? "LINK" : "REVOKE"} VIBY ADMIN viby-subject-1${userId ? ` TO ${userId}` : ""} IN ${path}`,
        },
        encoding: "utf8",
      },
    );
    expect(JSON.parse(run("link", "user-1"))).toMatchObject({ result: "created" });
    expect(JSON.parse(run("link", "user-1"))).toMatchObject({ result: "retained" });
    expect(() => run("link", "user-2")).toThrow();
    expect(JSON.parse(run("revoke"))).toMatchObject({ result: "revoked" });
    expect(JSON.parse(run("revoke"))).toMatchObject({ result: "retained" });
    expect(() => run("link", "user-1")).toThrow();
  }, 30_000);
});
