import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const protectedBackup = resolve(process.cwd(), "local.db.pre-p0-4.bak");
const requiredTables = [
  "users",
  "events",
  "submissions",
  "judges",
  "judge_assignments",
  "human_scores",
  "audit_events",
];

function targetPath() {
  if (process.env.DATABASE_URL?.trim()) {
    throw new Error("Remote DATABASE_URL migration is not supported.");
  }
  const configured = process.env.DB_FILE_NAME?.trim();
  if (!configured || !isAbsolute(configured)) {
    throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
  }
  const requested = resolve(configured);
  if (requested === protectedBackup) {
    throw new Error("The protected pre-P0.4 backup cannot be migrated.");
  }
  const stat = lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Target must be an existing regular, non-symlink file.");
  }
  accessSync(requested, constants.R_OK | constants.W_OK);
  const canonical = realpathSync(requested);
  if (canonical !== requested || canonical === protectedBackup) {
    throw new Error("Target must be its canonical non-protected path.");
  }
  return canonical;
}

function requireApplicationDatabase(sqlite: Database.Database) {
  const present = new Set((sqlite.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${requiredTables.map(() => "?").join(",")})`,
  ).all(...requiredTables) as Array<{ name: string }>).map((row) => row.name));
  const missing = requiredTables.filter((name) => !present.has(name));
  if (missing.length) {
    throw new Error(`Target is not a judge-capable Vibe Hackathon database; missing ${missing.join(", ")}.`);
  }
}

function scalar(sqlite: Database.Database, sql: string) {
  return Number((sqlite.prepare(sql).get() as { count: number }).count);
}

function preflight(sqlite: Database.Database) {
  const failures = [
    ["duplicate judge assignments", `
      SELECT count(*) count FROM (
        SELECT judge_id, submission_id FROM judge_assignments
        GROUP BY judge_id, submission_id HAVING count(*) > 1
      )`],
    ["duplicate judge scores", `
      SELECT count(*) count FROM (
        SELECT judge_id, submission_id FROM human_scores
        GROUP BY judge_id, submission_id HAVING count(*) > 1
      )`],
    ["orphaned judge assignments", `
      SELECT count(*) count FROM judge_assignments a
      LEFT JOIN judges j ON j.id=a.judge_id
      LEFT JOIN submissions s ON s.id=a.submission_id
      WHERE j.id IS NULL OR s.id IS NULL`],
    ["orphaned judge scores", `
      SELECT count(*) count FROM human_scores h
      LEFT JOIN judges j ON j.id=h.judge_id
      LEFT JOIN submissions s ON s.id=h.submission_id
      WHERE j.id IS NULL OR s.id IS NULL`],
    ["eventless judge assignments", `
      SELECT count(*) count FROM judge_assignments a
      JOIN submissions s ON s.id=a.submission_id WHERE s.event_id IS NULL`],
    ["eventless judge scores", `
      SELECT count(*) count FROM human_scores h
      JOIN submissions s ON s.id=h.submission_id WHERE s.event_id IS NULL`],
  ] as const;
  for (const [label, sql] of failures) {
    if (scalar(sqlite, sql) !== 0) {
      throw new Error(`Judge-authorization migration refused: ${label} exist.`);
    }
  }
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) {
    throw new Error("Existing foreign-key validation failed.");
  }
}

function normalizedTableSql(sqlite: Database.Database, table: string) {
  return String((sqlite.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table) as { sql?: string } | undefined)?.sql ?? "")
    .replace(/["`]/g, "")
    .replace(new RegExp(`${table}\\.`, "g"), "")
    .replace(/\s+/g, " ")
    .replace(/,\s*/g, ",")
    .toLowerCase();
}

function preflightExistingAuthorizationTable(sqlite: Database.Database) {
  if (!sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='judge_authorizations'",
  ).get()) return;
  const columns = (sqlite.prepare("PRAGMA table_info(judge_authorizations)").all() as Array<{
    name: string;
  }>).map((column) => column.name);
  const expected = [
    "id",
    "user_id",
    "judge_id",
    "event_id",
    "status",
    "grant_provenance",
    "granted_by_user_id",
    "invited_at",
    "accepted_at",
    "revoked_at",
    "revocation_reason",
    "created_at",
    "updated_at",
  ];
  if (columns.length !== expected.length || columns.some((column, index) => column !== expected[index])) {
    throw new Error("judge_authorizations has an incompatible column set.");
  }
}

export function validateJudgeAuthorizationSchema(sqlite: Database.Database) {
  const columns = sqlite.prepare("PRAGMA table_info(judge_authorizations)").all() as Array<{
    name: string;
    type: string;
    notnull: number;
    dflt_value: string | null;
    pk: number;
  }>;
  const expected = new Map<string, { type: string; notnull: number; pk: number }>([
    ["id", { type: "TEXT", notnull: 1, pk: 1 }],
    ["user_id", { type: "TEXT", notnull: 1, pk: 0 }],
    ["judge_id", { type: "TEXT", notnull: 1, pk: 0 }],
    ["event_id", { type: "TEXT", notnull: 1, pk: 0 }],
    ["status", { type: "TEXT", notnull: 1, pk: 0 }],
    ["grant_provenance", { type: "TEXT", notnull: 1, pk: 0 }],
    ["granted_by_user_id", { type: "TEXT", notnull: 0, pk: 0 }],
    ["invited_at", { type: "INTEGER", notnull: 0, pk: 0 }],
    ["accepted_at", { type: "INTEGER", notnull: 0, pk: 0 }],
    ["revoked_at", { type: "INTEGER", notnull: 0, pk: 0 }],
    ["revocation_reason", { type: "TEXT", notnull: 0, pk: 0 }],
    ["created_at", { type: "INTEGER", notnull: 1, pk: 0 }],
    ["updated_at", { type: "INTEGER", notnull: 1, pk: 0 }],
  ]);
  if (columns.length !== expected.size) {
    throw new Error("judge_authorizations has an incompatible column set.");
  }
  for (const column of columns) {
    const invariant = expected.get(column.name);
    if (
      !invariant
      || column.type.toUpperCase() !== invariant.type
      || column.notnull !== invariant.notnull
      || column.pk !== invariant.pk
    ) {
      throw new Error(`judge_authorizations column invariant failed: ${column.name}.`);
    }
  }
  for (const timestamp of ["created_at", "updated_at"]) {
    if (!columns.find((column) => column.name === timestamp)?.dflt_value?.includes("strftime")) {
      throw new Error(`judge_authorizations default is incompatible: ${timestamp}.`);
    }
  }

  const tableSql = normalizedTableSql(sqlite, "judge_authorizations");
  for (const fragment of [
    "status in ('invited', 'active', 'revoked')",
    "status = 'invited'",
    "status = 'active'",
    "status = 'revoked'",
  ]) {
    if (!tableSql.includes(fragment.replace(/,\s*/g, ","))) {
      throw new Error(`judge_authorizations constraint is missing: ${fragment}.`);
    }
  }

  const foreignKeys = sqlite.prepare("PRAGMA foreign_key_list(judge_authorizations)").all() as Array<{
    table: string;
    from: string;
    to: string;
    on_delete: string;
  }>;
  const requiredForeignKeys = [
    ["user_id", "users", "RESTRICT"],
    ["judge_id", "judges", "RESTRICT"],
    ["event_id", "events", "RESTRICT"],
    ["granted_by_user_id", "users", "SET NULL"],
  ] as const;
  for (const [from, table, onDelete] of requiredForeignKeys) {
    if (!foreignKeys.some((foreignKey) =>
      foreignKey.from === from
      && foreignKey.table === table
      && foreignKey.to === "id"
      && foreignKey.on_delete === onDelete
    )) {
      throw new Error(`judge_authorizations foreign key is incompatible: ${from}.`);
    }
  }

  const requiredIndexes = [
    "judge_authorizations_user_idx",
    "judge_authorizations_judge_idx",
    "judge_authorizations_event_idx",
    "judge_authorizations_status_idx",
    "judge_authorizations_user_event_idx",
    "judge_authorizations_judge_event_idx",
    "judge_authorizations_status_event_idx",
    "judge_authorizations_active_user_event_unique",
    "judge_authorizations_active_judge_event_unique",
    "judge_assignments_judge_submission_unique",
    "human_scores_judge_submission_unique",
  ];
  const indexes = new Map((sqlite.prepare(
    `SELECT name, sql FROM sqlite_master WHERE type='index' AND name IN (${requiredIndexes.map(() => "?").join(",")})`,
  ).all(...requiredIndexes) as Array<{ name: string; sql: string }>)
    .map((index) => [index.name, index.sql]));
  for (const index of requiredIndexes) {
    if (!indexes.has(index)) throw new Error(`Required judge authorization index is missing: ${index}.`);
  }
  for (const index of [
    "judge_authorizations_active_user_event_unique",
    "judge_authorizations_active_judge_event_unique",
  ]) {
    const sql = (indexes.get(index) ?? "")
      .replace(/["`]/g, "")
      .replace(/judge_authorizations\./g, "")
      .replace(/\s+/g, " ");
    if (!/create unique index/i.test(sql) || !/where status\s*=\s*'active'/i.test(sql)) {
      throw new Error(`Active-authorization partial uniqueness is incompatible: ${index}.`);
    }
  }
  if (sqlite.pragma("foreign_keys", { simple: true }) !== 1) {
    throw new Error("SQLite foreign-key enforcement is not active.");
  }
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) {
    throw new Error("Foreign-key validation failed.");
  }
}

const target = targetPath();
const expectedConfirmation = `MIGRATE JUDGE AUTHORIZATIONS DATABASE ${target}`;
if (process.env.VIBE_JUDGE_AUTHORIZATION_MIGRATION_CONFIRM !== expectedConfirmation) {
  throw new Error(`Confirmation required: ${JSON.stringify(expectedConfirmation)}.`);
}

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  requireApplicationDatabase(sqlite);
  preflight(sqlite);
  preflightExistingAuthorizationTable(sqlite);
  const authorizationTablePresent = Boolean(sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='judge_authorizations'",
  ).get());
  const countsBefore = {
    judges: scalar(sqlite, "SELECT count(*) count FROM judges"),
    assignments: scalar(sqlite, "SELECT count(*) count FROM judge_assignments"),
    scores: scalar(sqlite, "SELECT count(*) count FROM human_scores"),
    authorizations: authorizationTablePresent
      ? scalar(sqlite, "SELECT count(*) count FROM judge_authorizations")
      : 0,
  };
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS judge_authorizations (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        judge_id TEXT NOT NULL REFERENCES judges(id) ON DELETE RESTRICT,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK (status IN ('invited', 'active', 'revoked')),
        grant_provenance TEXT NOT NULL,
        granted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        invited_at INTEGER,
        accepted_at INTEGER,
        revoked_at INTEGER,
        revocation_reason TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT judge_authorizations_lifecycle_check CHECK (
          (status = 'invited' AND invited_at IS NOT NULL AND accepted_at IS NULL AND revoked_at IS NULL)
          OR (status = 'active' AND accepted_at IS NOT NULL AND revoked_at IS NULL)
          OR (status = 'revoked' AND revoked_at IS NOT NULL)
        )
      );
      CREATE INDEX IF NOT EXISTS judge_authorizations_user_idx ON judge_authorizations(user_id);
      CREATE INDEX IF NOT EXISTS judge_authorizations_judge_idx ON judge_authorizations(judge_id);
      CREATE INDEX IF NOT EXISTS judge_authorizations_event_idx ON judge_authorizations(event_id);
      CREATE INDEX IF NOT EXISTS judge_authorizations_status_idx ON judge_authorizations(status);
      CREATE INDEX IF NOT EXISTS judge_authorizations_user_event_idx ON judge_authorizations(user_id,event_id);
      CREATE INDEX IF NOT EXISTS judge_authorizations_judge_event_idx ON judge_authorizations(judge_id,event_id);
      CREATE INDEX IF NOT EXISTS judge_authorizations_status_event_idx ON judge_authorizations(status,event_id);
      CREATE UNIQUE INDEX IF NOT EXISTS judge_authorizations_active_user_event_unique
        ON judge_authorizations(user_id,event_id) WHERE status='active';
      CREATE UNIQUE INDEX IF NOT EXISTS judge_authorizations_active_judge_event_unique
        ON judge_authorizations(judge_id,event_id) WHERE status='active';
      CREATE UNIQUE INDEX IF NOT EXISTS judge_assignments_judge_submission_unique
        ON judge_assignments(judge_id,submission_id);
      CREATE UNIQUE INDEX IF NOT EXISTS human_scores_judge_submission_unique
        ON human_scores(judge_id,submission_id);
    `);
    validateJudgeAuthorizationSchema(sqlite);
    const countsAfter = {
      judges: scalar(sqlite, "SELECT count(*) count FROM judges"),
      assignments: scalar(sqlite, "SELECT count(*) count FROM judge_assignments"),
      scores: scalar(sqlite, "SELECT count(*) count FROM human_scores"),
      authorizations: scalar(sqlite, "SELECT count(*) count FROM judge_authorizations"),
    };
    if (
      countsAfter.judges !== countsBefore.judges
      || countsAfter.assignments !== countsBefore.assignments
      || countsAfter.scores !== countsBefore.scores
      || countsAfter.authorizations !== countsBefore.authorizations
    ) {
      throw new Error("Judge-authorization migration changed protected application data.");
    }
  })();
  console.log(JSON.stringify({
    database: target,
    schema: "valid",
    counts: countsBefore,
    authorizationsCreated: 0,
    foreignKeyCheck: "passed",
  }));
} finally {
  sqlite.close();
}
