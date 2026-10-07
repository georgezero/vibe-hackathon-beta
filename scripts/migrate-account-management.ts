import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const protectedBackup = resolve(process.cwd(), "local.db.pre-p0-4.bak");

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

function tableExists(sqlite: Database.Database, table: string) {
  return Boolean(sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table));
}

function validate(sqlite: Database.Database) {
  const expectedColumns = [
    "user_id",
    "status",
    "password_change_required",
    "temporary_password_issued_at",
    "password_changed_at",
    "disabled_at",
    "disabled_by_user_id",
    "created_at",
    "updated_at",
  ];
  const columns = (sqlite.prepare(
    "PRAGMA table_info(user_account_controls)",
  ).all() as Array<{ name: string }>).map((column) => column.name);
  if (
    columns.length !== expectedColumns.length
    || columns.some((column, index) => column !== expectedColumns[index])
  ) {
    throw new Error("user_account_controls has an incompatible column set.");
  }

  const foreignKeys = sqlite.prepare(
    "PRAGMA foreign_key_list(user_account_controls)",
  ).all() as Array<{ from: string; table: string; to: string; on_delete: string }>;
  const required = [
    ["user_id", "users", "id", "CASCADE"],
    ["disabled_by_user_id", "users", "id", "SET NULL"],
  ] as const;
  for (const [from, table, to, onDelete] of required) {
    if (!foreignKeys.some((foreignKey) =>
      foreignKey.from === from
      && foreignKey.table === table
      && foreignKey.to === to
      && foreignKey.on_delete === onDelete
    )) {
      throw new Error(`Account-control foreign key is incompatible: ${from}.`);
    }
  }

  const sql = String((sqlite.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='user_account_controls'",
  ).get() as { sql: string }).sql)
    .replace(/["`]/g, "")
    .replace(/user_account_controls\./g, "")
    .replace(/\s+/g, " ")
    .replace(/,\s*/g, ",")
    .toLowerCase();
  for (const fragment of [
    "status in ('active', 'disabled')",
    "status = 'active'",
    "status = 'disabled'",
  ]) {
    if (!sql.includes(fragment.replace(/,\s*/g, ","))) {
      throw new Error(`Account-control constraint is missing: ${fragment}.`);
    }
  }
  for (const index of [
    "user_account_controls_status_idx",
    "user_account_controls_password_change_idx",
  ]) {
    if (!sqlite.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='index' AND name=?",
    ).get(index)) {
      throw new Error(`Account-control index is missing: ${index}.`);
    }
  }
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) {
    throw new Error("Foreign-key validation failed.");
  }
}

const target = targetPath();
const expectedConfirmation = `MIGRATE ACCOUNT MANAGEMENT DATABASE ${target}`;
if (process.env.VIBE_ACCOUNT_MANAGEMENT_MIGRATION_CONFIRM !== expectedConfirmation) {
  throw new Error(`Confirmation required: ${JSON.stringify(expectedConfirmation)}.`);
}

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  for (const required of ["users", "sessions", "accounts", "admin_authorizations", "judge_authorizations"]) {
    if (!tableExists(sqlite, required)) {
      throw new Error(`Target is missing required application table: ${required}.`);
    }
  }
  const before = tableExists(sqlite, "user_account_controls")
    ? Number((sqlite.prepare(
      "SELECT count(*) count FROM user_account_controls",
    ).get() as { count: number }).count)
    : 0;

  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS user_account_controls (
        user_id TEXT PRIMARY KEY NOT NULL
          REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active',
        password_change_required INTEGER NOT NULL DEFAULT 0,
        temporary_password_issued_at INTEGER,
        password_changed_at INTEGER,
        disabled_at INTEGER,
        disabled_by_user_id TEXT
          REFERENCES users(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT user_account_controls_status_check
          CHECK (status IN ('active', 'disabled')),
        CONSTRAINT user_account_controls_disabled_state_check
          CHECK (
            (status = 'active' AND disabled_at IS NULL)
            OR (status = 'disabled' AND disabled_at IS NOT NULL)
          )
      );
      CREATE INDEX IF NOT EXISTS user_account_controls_status_idx
        ON user_account_controls(status);
      CREATE INDEX IF NOT EXISTS user_account_controls_password_change_idx
        ON user_account_controls(password_change_required);
    `);
    validate(sqlite);
  })();

  const after = Number((sqlite.prepare(
    "SELECT count(*) count FROM user_account_controls",
  ).get() as { count: number }).count);
  console.log(JSON.stringify({
    database: target,
    accountControlsBefore: before,
    accountControlsAfter: after,
    automaticRowsCreated: after - before,
    foreignKeyCheck: "passed",
  }));
} finally {
  sqlite.close();
}
