import Database from "better-sqlite3";
import {
  accessSync,
  constants,
  lstatSync,
  realpathSync,
} from "fs";
import { isAbsolute, resolve } from "path";

const protectedBackup = resolve(process.cwd(), "local.db.pre-p0-4.bak");
const requiredExistingTables = ["users", "sessions", "accounts", "events", "submissions"];

function targetPath() {
  if (process.env.DATABASE_URL?.trim()) {
    throw new Error("This migration does not support remote DATABASE_URL targets.");
  }
  const configured = process.env.DB_FILE_NAME?.trim();
  if (!configured || !isAbsolute(configured)) {
    throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
  }
  const requested = resolve(configured);
  if (requested === protectedBackup) {
    throw new Error("The protected pre-P0.4 backup cannot be used as a migration target.");
  }
  const stat = lstatSync(requested);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error("The migration target must be an existing regular, non-symlink file.");
  }
  accessSync(requested, constants.R_OK | constants.W_OK);
  const canonical = realpathSync(requested);
  if (canonical !== requested) {
    throw new Error("DB_FILE_NAME must be the canonical path to the migration target.");
  }
  if (canonical === protectedBackup) {
    throw new Error("The protected pre-P0.4 backup cannot be used as a migration target.");
  }
  return canonical;
}

function requireApplicationDatabase(sqlite: Database.Database) {
  const rows = sqlite.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${requiredExistingTables.map(() => "?").join(",")})`,
  ).all(...requiredExistingTables) as Array<{ name: string }>;
  const present = new Set(rows.map((row) => row.name));
  const missing = requiredExistingTables.filter((name) => !present.has(name));
  if (missing.length) {
    throw new Error(`Target is not a recognized Vibe Hackathon database; missing required schema: ${missing.join(", ")}.`);
  }
}

function validateFinalSchema(sqlite: Database.Database) {
  if (sqlite.pragma("foreign_keys", { simple: true }) !== 1) {
    throw new Error("SQLite foreign-key enforcement is not active.");
  }
  const columns = sqlite.prepare("PRAGMA table_info(admin_authorizations)").all() as Array<{
    name: string; notnull: number; dflt_value: string | null; pk: number;
  }>;
  const expectedColumns = new Map([
    ["id", { notnull: 1, pk: 1 }],
    ["user_id", { notnull: 1, pk: 0 }],
    ["status", { notnull: 1, pk: 0 }],
    ["grant_source", { notnull: 1, pk: 0 }],
    ["created_at", { notnull: 1, pk: 0 }],
    ["updated_at", { notnull: 1, pk: 0 }],
    ["revoked_at", { notnull: 0, pk: 0 }],
  ]);
  if (columns.length !== expectedColumns.size) {
    throw new Error("admin_authorizations has an incompatible column set.");
  }
  for (const column of columns) {
    const expected = expectedColumns.get(column.name);
    if (!expected || column.notnull !== expected.notnull || column.pk !== expected.pk) {
      throw new Error(`admin_authorizations column invariant failed: ${column.name}.`);
    }
  }
  const status = columns.find((column) => column.name === "status");
  const source = columns.find((column) => column.name === "grant_source");
  const createdAt = columns.find((column) => column.name === "created_at");
  const updatedAt = columns.find((column) => column.name === "updated_at");
  if (status?.dflt_value !== "'active'" || source?.dflt_value !== "'operator'") {
    throw new Error("admin_authorizations defaults are incompatible.");
  }
  if (!createdAt?.dflt_value?.includes("strftime") || !updatedAt?.dflt_value?.includes("strftime")) {
    throw new Error("admin_authorizations timestamp defaults are incompatible.");
  }
  const tableSql = (sqlite.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='admin_authorizations'",
  ).get() as { sql: string } | undefined)?.sql ?? "";
  const normalizedTableSql = tableSql.replace(/["`]/g, "").replace(/admin_authorizations\./g, "");
  if (!/CHECK\s*\(status IN \('active', 'revoked'\)\)/i.test(normalizedTableSql)) {
    throw new Error("admin_authorizations status constraint is missing.");
  }
  const foreignKeys = sqlite.prepare("PRAGMA foreign_key_list(admin_authorizations)").all() as Array<{
    table: string; from: string; to: string; on_delete: string;
  }>;
  if (!foreignKeys.some((fk) =>
    fk.table === "users" && fk.from === "user_id" && fk.to === "id" && fk.on_delete === "CASCADE"
  )) {
    throw new Error("admin_authorizations user foreign key is incompatible.");
  }
  const indexes = sqlite.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type='index' AND name IN (?, ?, ?)",
  ).all(
    "admin_authorizations_user_unique",
    "admin_authorizations_status_idx",
    "accounts_credential_user_unique",
  ) as Array<{ name: string; sql: string }>;
  const byName = new Map(indexes.map((index) => [index.name, index.sql]));
  const indexColumns = (name: string) =>
    (sqlite.prepare(`PRAGMA index_info(${name})`).all() as Array<{ name: string }>).map((row) => row.name);
  const credentialIndexSql = (byName.get("accounts_credential_user_unique") ?? "")
    .replace(/["`]/g, "")
    .replace(/accounts\./g, "");
  if (!byName.has("admin_authorizations_user_unique")
    || !byName.has("admin_authorizations_status_idx")
    || !/UNIQUE/i.test(byName.get("admin_authorizations_user_unique") ?? "")
    || !/UNIQUE/i.test(byName.get("accounts_credential_user_unique") ?? "")
    || !/WHERE\s+provider_id\s*=\s*'credential'/i.test(credentialIndexSql)
    || indexColumns("admin_authorizations_user_unique").join(",") !== "user_id"
    || indexColumns("admin_authorizations_status_idx").join(",") !== "status"
    || indexColumns("accounts_credential_user_unique").join(",") !== "user_id") {
    throw new Error("Required admin-auth indexes are missing or incompatible.");
  }
  const duplicateGrants = sqlite.prepare(
    "SELECT user_id FROM admin_authorizations GROUP BY user_id HAVING count(*) > 1 LIMIT 1",
  ).get();
  const duplicateCredentials = sqlite.prepare(
    "SELECT user_id FROM accounts WHERE provider_id='credential' GROUP BY user_id HAVING count(*) > 1 LIMIT 1",
  ).get();
  if (duplicateGrants || duplicateCredentials) {
    throw new Error("Duplicate admin grants or credential accounts violate migration invariants.");
  }
}

const target = targetPath();
const expected = `MIGRATE ADMIN AUTH DATABASE ${target}`;
if (process.env.VIBE_ADMIN_AUTH_MIGRATION_CONFIRM !== expected) {
  throw new Error(`Confirmation required. Set VIBE_ADMIN_AUTH_MIGRATION_CONFIRM exactly to ${JSON.stringify(expected)}.`);
}
const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  requireApplicationDatabase(sqlite);
  const alreadyPresent = Boolean(sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name='admin_authorizations'",
  ).get());
  sqlite.transaction(() => {
    const duplicates = sqlite.prepare(`
      SELECT user_id FROM accounts WHERE provider_id = 'credential'
      GROUP BY user_id HAVING count(*) > 1
    `).all();
    if (duplicates.length) throw new Error("Duplicate credential accounts must be resolved before migration.");
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS admin_authorizations (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
        grant_source TEXT NOT NULL DEFAULT 'operator',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        revoked_at INTEGER
      );
      CREATE UNIQUE INDEX IF NOT EXISTS admin_authorizations_user_unique
        ON admin_authorizations(user_id);
      CREATE INDEX IF NOT EXISTS admin_authorizations_status_idx
        ON admin_authorizations(status);
      CREATE UNIQUE INDEX IF NOT EXISTS accounts_credential_user_unique
        ON accounts(user_id) WHERE provider_id = 'credential';
    `);
    validateFinalSchema(sqlite);
  })();
  console.log(alreadyPresent
    ? `Admin authorization schema was already valid for ${target}.`
    : `Admin authorization schema was created and validated for ${target}.`);
} finally {
  sqlite.close();
}
