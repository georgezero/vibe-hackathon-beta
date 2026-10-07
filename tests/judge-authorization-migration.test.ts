import Database from "better-sqlite3";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function liveShapeDatabase(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys=ON");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0, image TEXT,
      github_id TEXT UNIQUE, github_username TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE submissions (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL
    );
    CREATE TABLE judges (
      id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      email TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE judge_assignments (
      id TEXT PRIMARY KEY,
      judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE human_scores (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, actor_type TEXT, actor_id TEXT, metadata TEXT,
      created_at INTEGER NOT NULL
    );
    INSERT INTO users VALUES
      ('user-admin','Admin','admin@example.test',1,NULL,NULL,NULL,1,1),
      ('user-judge','Judge','account@example.test',1,NULL,NULL,NULL,1,1),
      ('user-other','Other','other@example.test',1,NULL,NULL,NULL,1,1);
    INSERT INTO events VALUES
      ('event-1','One','one',1,1,1),
      ('event-2','Two','two',0,1,1);
    INSERT INTO submissions VALUES ('submission-1','event-1'),('submission-2','event-1');
    INSERT INTO judges VALUES
      ('judge-1','private-token-1','Judge One','profile@example.test',1),
      ('judge-2','private-token-2','Judge Two','other-profile@example.test',1);
    INSERT INTO judge_assignments VALUES
      ('assignment-1','judge-1','submission-1',1),
      ('assignment-2','judge-1','submission-2',1);
    INSERT INTO human_scores VALUES
      ('score-1','submission-1','judge-1',1,1);
  `);
  sqlite.close();
}

function migrate(path: string) {
  return execFileSync("npx", ["tsx", "scripts/migrate-judge-authorizations.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DB_FILE_NAME: path,
      VIBE_JUDGE_AUTHORIZATION_MIGRATION_CONFIRM:
        `MIGRATE JUDGE AUTHORIZATIONS DATABASE ${path}`,
    },
    encoding: "utf8",
  });
}

function cli(path: string, args: string[]) {
  return execFileSync(
    "npm",
    ["run", "--silent", "db:judge-authorizations", "--", "--database", path, ...args],
    { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "test" }, encoding: "utf8" },
  );
}

describe("event-scoped judge authorization migration", () => {
  it("migrates twice, preserves judging data, and enforces restrictive references", () => {
    const directory = mkdtempSync(join(tmpdir(), "vibe-judge-auth-"));
    const path = join(directory, "app.db");
    liveShapeDatabase(path);
    expect(JSON.parse(migrate(path))).toMatchObject({
      schema: "valid",
      counts: { judges: 2, assignments: 2, scores: 1 },
      authorizationsCreated: 0,
      foreignKeyCheck: "passed",
    });
    expect(JSON.parse(migrate(path))).toMatchObject({
      schema: "valid",
      counts: { judges: 2, assignments: 2, scores: 1 },
      authorizationsCreated: 0,
    });

    const smoke = JSON.parse(execFileSync(
      "npx",
      ["tsx", "tests/helpers/judge-authorization-smoke.ts"],
      {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: "test", DB_FILE_NAME: path },
        encoding: "utf8",
      },
    ));
    expect(smoke).toMatchObject({
      none: "none",
      missingUser: { status: "rejected", reason: "missing_user" },
      missingJudge: { status: "rejected", reason: "missing_judge" },
      missingEvent: { status: "rejected", reason: "missing_event" },
      granted: "granted",
      active: "active",
      activeJudgeId: "judge-1",
      wrongEvent: "none",
      idempotent: "idempotent",
      userConflict: { status: "rejected", reason: "conflict" },
      judgeConflict: { status: "rejected", reason: "conflict" },
      noContextRoles: { isAdmin: false, isJudge: false },
      judgeRoles: { isAdmin: false, isJudge: true },
      adminJudgeRoles: { isAdmin: true, isJudge: true },
      revoked: "revoked",
      revokedAgain: "idempotent",
      afterRevoke: "revoked",
      authorizationHistory: 1,
    });

    const sqlite = new Database(path);
    sqlite.pragma("foreign_keys=ON");
    expect(sqlite.prepare("SELECT count(*) count FROM judges").get()).toEqual({ count: 2 });
    expect(sqlite.prepare("SELECT count(*) count FROM judge_assignments").get()).toEqual({ count: 2 });
    expect(sqlite.prepare("SELECT count(*) count FROM human_scores").get()).toEqual({ count: 1 });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(() => sqlite.prepare("DELETE FROM users WHERE id='user-judge'").run()).toThrow();
    expect(() => sqlite.prepare("DELETE FROM judges WHERE id='judge-1'").run()).toThrow();
    expect(() => sqlite.prepare("DELETE FROM events WHERE id='event-1'").run()).toThrow();
    expect(sqlite.prepare(
      "SELECT count(*) count FROM audit_events WHERE action='judge_authorization_granted'",
    ).get()).toEqual({ count: 1 });
    expect(sqlite.prepare(
      "SELECT count(*) count FROM audit_events WHERE action='judge_authorization_revoked'",
    ).get()).toEqual({ count: 1 });
    expect(sqlite.prepare(
      "SELECT count(*) count FROM audit_events WHERE action='judge_authorization_inspected'",
    ).get()).toEqual({ count: 1 });
    sqlite.prepare("DELETE FROM users WHERE id='user-admin'").run();
    expect(sqlite.prepare(
      "SELECT granted_by_user_id FROM judge_authorizations LIMIT 1",
    ).get()).toEqual({ granted_by_user_id: null });
    sqlite.close();
  }, 30_000);

  it("supports read-only inspection, dry-run, confirmed apply, and history-preserving revoke", () => {
    const directory = mkdtempSync(join(tmpdir(), "vibe-judge-tool-"));
    const path = join(directory, "app.db");
    liveShapeDatabase(path);
    migrate(path);

    const inspection = cli(path, ["--action", "inspect"]);
    expect(inspection).not.toContain("private-token");
    expect(JSON.parse(inspection)).toMatchObject({
      authorizations: [],
    });
    const dryRun = JSON.parse(cli(path, [
      "--action", "grant",
      "--user-id", "user-judge",
      "--judge-id", "judge-1",
      "--event-id", "event-1",
      "--provenance", "operator_test",
      "--dry-run",
    ]));
    expect(dryRun).toMatchObject({ dryRun: true, preview: { status: "ready" } });
    const before = new Database(path, { readonly: true });
    expect(before.prepare("SELECT count(*) count FROM judge_authorizations").get())
      .toEqual({ count: 0 });
    before.close();

    const confirmation =
      `GRANT JUDGE AUTHORIZATION user-judge judge-1 event-1 ON ${path}`;
    const applied = JSON.parse(cli(path, [
      "--action", "grant",
      "--user-id", "user-judge",
      "--judge-id", "judge-1",
      "--event-id", "event-1",
      "--provenance", "operator_test",
      "--apply",
      "--confirm", confirmation,
    ]));
    expect(applied.result.status).toBe("granted");
    const idempotent = JSON.parse(cli(path, [
      "--action", "grant",
      "--user-id", "user-judge",
      "--judge-id", "judge-1",
      "--event-id", "event-1",
      "--provenance", "operator_test",
      "--apply",
      "--confirm", confirmation,
    ]));
    expect(idempotent.result.status).toBe("idempotent");
    expect(JSON.parse(migrate(path))).toMatchObject({
      schema: "valid",
      counts: {
        judges: 2,
        assignments: 2,
        scores: 1,
        authorizations: 1,
      },
      authorizationsCreated: 0,
    });

    const authorizationId = applied.result.authorizationId as string;
    const revoked = JSON.parse(cli(path, [
      "--action", "revoke",
      "--authorization-id", authorizationId,
      "--reason", "qualification_complete",
      "--apply",
      "--confirm", `REVOKE JUDGE AUTHORIZATION ${authorizationId} ON ${path}`,
    ]));
    expect(revoked.result.status).toBe("revoked");
    const sqlite = new Database(path, { readonly: true });
    expect(sqlite.prepare(
      "SELECT status,revocation_reason FROM judge_authorizations WHERE id=?",
    ).get(authorizationId)).toEqual({
      status: "revoked",
      revocation_reason: "qualification_complete",
    });
    expect(sqlite.prepare("SELECT count(*) count FROM judge_assignments").get())
      .toEqual({ count: 2 });
    expect(sqlite.prepare("SELECT count(*) count FROM human_scores").get())
      .toEqual({ count: 1 });
    sqlite.close();
  }, 30_000);

  it("requires explicit IDs and contains no email-matching implementation", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/manage-judge-authorizations.ts"),
      "utf8",
    );
    expect(source).toContain("--user-id");
    expect(source).toContain("--judge-id");
    expect(source).toContain("--event-id");
    expect(source).not.toContain("--email");

    const directory = mkdtempSync(join(tmpdir(), "vibe-judge-tool-invalid-"));
    const path = join(directory, "app.db");
    liveShapeDatabase(path);
    migrate(path);
    const result = spawnSync("npm", [
      "run", "--silent", "db:judge-authorizations", "--",
      "--database", path,
      "--action", "grant",
      "--email", "profile@example.test",
      "--dry-run",
    ], { cwd: process.cwd(), encoding: "utf8" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unknown argument: --email");
  }, 30_000);

  it("refuses duplicate ownership pairs without changing the schema", () => {
    const directory = mkdtempSync(join(tmpdir(), "vibe-judge-duplicate-"));
    const path = join(directory, "app.db");
    liveShapeDatabase(path);
    const sqlite = new Database(path);
    sqlite.prepare(
      "INSERT INTO judge_assignments VALUES ('assignment-duplicate','judge-1','submission-1',1)",
    ).run();
    sqlite.close();
    const result = spawnSync("npx", ["tsx", "scripts/migrate-judge-authorizations.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DB_FILE_NAME: path,
        VIBE_JUDGE_AUTHORIZATION_MIGRATION_CONFIRM:
          `MIGRATE JUDGE AUTHORIZATIONS DATABASE ${path}`,
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("duplicate judge assignments");
    const check = new Database(path, { readonly: true });
    expect(check.prepare(
      "SELECT count(*) count FROM sqlite_master WHERE name='judge_authorizations'",
    ).get()).toEqual({ count: 0 });
    check.close();
  }, 30_000);

  it("detects a structurally incompatible pre-existing authorization table", () => {
    const directory = mkdtempSync(join(tmpdir(), "vibe-judge-incompatible-"));
    const path = join(directory, "app.db");
    liveShapeDatabase(path);
    const sqlite = new Database(path);
    sqlite.exec("CREATE TABLE judge_authorizations (id TEXT PRIMARY KEY, unexpected TEXT)");
    sqlite.close();
    const result = spawnSync("npx", ["tsx", "scripts/migrate-judge-authorizations.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DB_FILE_NAME: path,
        VIBE_JUDGE_AUTHORIZATION_MIGRATION_CONFIRM:
          `MIGRATE JUDGE AUTHORIZATIONS DATABASE ${path}`,
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("incompatible column set");
    const check = new Database(path, { readonly: true });
    const columns = check.prepare("PRAGMA table_info(judge_authorizations)").all() as Array<{
      name: string;
    }>;
    expect(columns.map((column) => column.name)).toEqual(["id", "unexpected"]);
    check.close();
  }, 30_000);
});
