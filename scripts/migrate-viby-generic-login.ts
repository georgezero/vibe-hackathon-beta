import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const protectedBackup = resolve(process.cwd(), "local.db.pre-p0-4.bak");
const tables = [
  "viby_login_transactions",
  "viby_identity_link_transactions",
  "admin_session_provenance",
  "viby_session_handoffs",
  "viby_legacy_identity_claims",
] as const;

function targetPath() {
  if (process.env.DATABASE_URL?.trim()) throw new Error("Remote DATABASE_URL migration is not supported.");
  const configured = process.env.DB_FILE_NAME?.trim();
  if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
  const requested = resolve(configured);
  if (requested === protectedBackup) throw new Error("The protected pre-P0.4 backup cannot be migrated.");
  const stat = lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
  accessSync(requested, constants.R_OK | constants.W_OK);
  const canonical = realpathSync(requested);
  if (canonical !== requested || canonical === protectedBackup) throw new Error("Target must be its canonical non-protected path.");
  return canonical;
}

function tableSql(sqlite: Database.Database, table: string) {
  return String((sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table) as { sql?: string } | undefined)?.sql ?? "")
    .replace(/["`]/g, "")
    .replace(new RegExp(`${table}\\.`, "g"), "")
    .replace(/\s+/g, " ")
    .replace(/,\s*/g, ",");
}

function hasGenericOperation(sql: string) {
  return /operation\s+in\s*\(\s*'application_login'\s*,\s*'admin_login'\s*,\s*'judge_login'\s*\)/i.test(sql.replace(/\s+/g, " "));
}

function withGenericOperation(sql: string, table: string) {
  const normalized = sql.replace(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?[^\s(]+["`]?/i, `CREATE TABLE ${table}`);
  return normalized.replace(
    /operation\s+IN\s*\(\s*'admin_login'\s*,\s*'judge_login'\s*\)/gi,
    "operation IN ('application_login', 'admin_login', 'judge_login')",
  );
}

function explicitIndexes(sqlite: Database.Database, table: string) {
  const rows = sqlite.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string; origin: string }>;
  return rows
    .filter((row) => row.origin !== "pk" && row.origin !== "u")
    .map((row) => String((sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name=?").get(row.name) as { sql?: string } | undefined)?.sql ?? ""))
    .filter(Boolean);
}

function rebuild(sqlite: Database.Database) {
  const originals = new Map(tables.map((table) => [table, tableSql(sqlite, table)]));
  if (tables.every((table) => hasGenericOperation(originals.get(table) ?? "") || table === "viby_legacy_identity_claims")) return false;
  const indexes = new Map(tables.map((table) => [table, explicitIndexes(sqlite, table)]));
  const oldName = (table: string) => `${table}__b47_old`;

  for (const table of tables) {
    if (!originals.get(table)) throw new Error(`Missing required table: ${table}`);
    if (tableSql(sqlite, oldName(table))) throw new Error(`Interrupted migration marker exists for ${table}.`);
  }
  for (const table of tables) {
    for (const indexSql of indexes.get(table) ?? []) {
      const indexName = indexSql.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+([^\s]+)\s+/i)?.[1];
      if (indexName) sqlite.exec(`DROP INDEX IF EXISTS ${indexName}`);
    }
  }
  for (const table of tables) sqlite.exec(`ALTER TABLE ${table} RENAME TO ${oldName(table)}`);

  const createOrder = [
    "viby_login_transactions",
    "viby_identity_link_transactions",
    "admin_session_provenance",
    "viby_session_handoffs",
    "viby_legacy_identity_claims",
  ];
  for (const table of createOrder) sqlite.exec(withGenericOperation(originals.get(table as typeof tables[number])!, table));
  for (const table of createOrder) {
    const columns = (sqlite.prepare(`PRAGMA table_info(${oldName(table)})`).all() as Array<{ name: string }>).map((row) => row.name);
    const quoted = columns.map((column) => `"${column}"`).join(", ");
    sqlite.exec(`INSERT INTO ${table} (${quoted}) SELECT ${quoted} FROM ${oldName(table)}`);
  }
  for (const table of [...createOrder].reverse()) sqlite.exec(`DROP TABLE ${oldName(table)}`);
  for (const table of tables) {
    for (const indexSql of indexes.get(table) ?? []) sqlite.exec(indexSql);
  }
  return true;
}

const target = targetPath();
const expected = `MIGRATE VIBY GENERIC LOGIN DATABASE ${target}`;
if (process.env.VIBE_PHASE_B47_MIGRATION_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);
const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = OFF");
  const changed = sqlite.transaction(() => rebuild(sqlite))();
  sqlite.pragma("foreign_keys = ON");
  const invalid = sqlite.pragma("foreign_key_check") as unknown[];
  if (invalid.length) throw new Error("Foreign-key validation failed.");
  for (const table of ["viby_login_transactions", "viby_session_handoffs", "admin_session_provenance", "viby_identity_link_transactions"]) {
    if (!hasGenericOperation(tableSql(sqlite, table))) throw new Error(`Generic operation enum missing from ${table}.`);
  }
  console.log(`Generic login schema is valid for ${target}; ${changed ? "rebuilt operation tables" : "already current"}.`);
} finally {
  sqlite.close();
}
