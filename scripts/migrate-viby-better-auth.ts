import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const protectedBackup = resolve(process.cwd(), "local.db.pre-p0-4.bak");

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

function columns(sqlite: Database.Database, table: string) {
  return new Set((sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name));
}

function requireApplicationDatabase(sqlite: Database.Database) {
  for (const table of ["users", "sessions", "accounts", "admin_authorizations", "viby_identity_links"]) {
    if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) {
      throw new Error(`Target is not a Phase A Vibe Hackathon database; missing ${table}.`);
    }
  }
}

function validate(sqlite: Database.Database) {
  const linkColumns = columns(sqlite, "viby_identity_links");
  for (const name of [
    "application_id", "status", "link_provenance", "environment",
    "binding_provenance", "bound_at", "last_authenticated_at", "link_scope",
  ]) {
    if (!linkColumns.has(name)) throw new Error(`Missing identity-link column: ${name}.`);
  }
  for (const table of [
    "viby_login_transactions", "viby_session_handoffs", "admin_session_provenance",
    "viby_identity_link_transactions", "viby_legacy_identity_claims",
  ]) {
    if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) {
      throw new Error(`Missing Phase B table: ${table}.`);
    }
  }
  const requiredColumns: Record<string, string[]> = {
    viby_login_transactions: ["id", "state_hash", "browser_binding_hash", "operation", "return_to", "expected_audience", "freshness_required", "created_at", "expires_at", "consumed_at", "failure_code"],
    viby_session_handoffs: ["id", "token_hash", "transaction_id", "identity_link_id", "user_id", "viby_subject_hash", "operation", "return_to", "verification_kind", "verified_at", "created_at", "expires_at", "consumed_at"],
    admin_session_provenance: ["id", "session_id", "authentication_method", "identity_link_id", "viby_subject_hash", "operation", "verification_kind", "verified_at", "created_at"],
    viby_identity_link_transactions: ["id", "token_hash", "browser_binding_hash", "viby_subject", "viby_subject_hash", "application_id", "environment", "identity_session_id", "verified_at", "assertion_correlation_hash", "expected_user_id", "return_to", "operation", "transaction_type", "status", "attempt_count", "created_at", "expires_at", "consumed_at", "cancelled_at", "failure_code"],
    viby_legacy_identity_claims: ["transaction_id", "identity_link_id", "expected_status", "expected_user_unbound", "expected_application_id", "expected_environment", "expected_subject_hash", "created_at"],
  };
  for (const [table, expectedColumns] of Object.entries(requiredColumns)) {
    const actual = columns(sqlite, table);
    for (const column of expectedColumns) {
      if (!actual.has(column)) throw new Error(`Missing ${table} column: ${column}.`);
    }
  }
  const tableSql = (name: string) => String((sqlite.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
  ).get(name) as { sql?: string } | undefined)?.sql ?? "")
    .replace(/["`]/g, "")
    .replace(/(?:viby_login_transactions|viby_session_handoffs|admin_session_provenance|viby_identity_link_transactions|viby_legacy_identity_claims)\./g, "")
    .replace(/\s+/g, " ")
    .replace(/, /g, ",")
    .toLowerCase();
  const operationConstraint = (sql: string) =>
    /operation in \(\s*'application_login'\s*,\s*'admin_login'\s*,\s*'judge_login'\s*\)|operation in \(\s*'admin_login'\s*,\s*'judge_login'\s*\)/i.test(sql);
  const freshnessConstraint = (sql: string) =>
    /freshness_required integer (?:default (?:true|1) )?not null/i.test(sql);
  const loginSql = tableSql("viby_login_transactions");
  const handoffSql = tableSql("viby_session_handoffs");
  const provenanceSql = tableSql("admin_session_provenance");
  const interactiveLinkSql = tableSql("viby_identity_link_transactions");
  const legacyClaimSql = tableSql("viby_legacy_identity_claims");
  for (const [label, sql, fragments] of [
    ["login transaction", loginSql, ["__operation_constraint__", "__freshness_constraint__"]],
    ["session handoff", handoffSql, ["__operation_constraint__", "on delete cascade"]],
    ["session provenance", provenanceSql, ["authentication_method = 'better_auth_viby'", "on delete restrict"]],
    ["interactive link", interactiveLinkSql, [
      "status in ('pending','confirmed','cancelled','failed')",
      "transaction_type in ('create_new_link', 'claim_unbound_legacy_link')",
      "__operation_constraint__",
      "on delete restrict",
    ]],
    ["legacy claim", legacyClaimSql, ["expected_status = 'active'", "expected_user_unbound = 1", "on delete restrict", "on delete cascade"]],
  ] as const) {
    for (const fragment of fragments) {
      const valid = fragment === "__operation_constraint__"
        ? operationConstraint(sql)
        : fragment === "__freshness_constraint__"
          ? freshnessConstraint(sql)
          : sql.includes(fragment.replace(/, /g, ","));
      if (!valid) {
        throw new Error(`Invalid ${label} constraint: ${fragment}.`);
      }
    }
  }
  const requiredIndexes = [
    "viby_identity_links_application_subject_unique",
    "viby_identity_links_application_user_unique",
    "viby_login_transactions_expires_idx",
    "viby_session_handoffs_expires_idx",
    "admin_session_provenance_link_idx",
    "viby_link_transactions_expires_idx",
    "viby_link_transactions_subject_idx",
    "viby_legacy_claims_link_idx",
  ];
  for (const index of requiredIndexes) {
    if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(index)) {
      throw new Error(`Missing Phase B index: ${index}.`);
    }
  }
  const hasUniqueColumns = (table: string, expectedColumns: string[]) =>
    (sqlite.prepare(`PRAGMA index_list(${table})`).all() as Array<{ name: string; unique: number }>)
      .filter((index) => index.unique === 1)
      .some((index) => {
        const columnsForIndex = (sqlite.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string | null; seqno: number }>)
          .sort((a, b) => a.seqno - b.seqno)
          .map((column) => column.name);
        return JSON.stringify(columnsForIndex) === JSON.stringify(expectedColumns);
      });
  for (const [table, expectedColumns] of [
    ["viby_login_transactions", ["state_hash"]],
    ["viby_session_handoffs", ["token_hash"]],
    ["admin_session_provenance", ["session_id"]],
    ["viby_identity_link_transactions", ["token_hash"]],
    ["viby_legacy_identity_claims", ["transaction_id"]],
  ] as const) {
    if (!hasUniqueColumns(table, [...expectedColumns])) {
      throw new Error(`Missing unique constraint for ${table}(${expectedColumns.join(", ")}).`);
    }
  }
  if (sqlite.pragma("foreign_keys", { simple: true }) !== 1) throw new Error("Foreign keys are not enabled.");
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
}

const target = targetPath();
const expected = `MIGRATE VIBY BETTER AUTH DATABASE ${target}`;
if (process.env.VIBE_PHASE_B_MIGRATION_CONFIRM !== expected) {
  throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);
}
const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  requireApplicationDatabase(sqlite);
  sqlite.transaction(() => {
    const existing = columns(sqlite, "viby_identity_links");
    if (!existing.has("application_id")) sqlite.exec("ALTER TABLE viby_identity_links ADD COLUMN application_id TEXT NOT NULL DEFAULT 'vibe-hackathon'");
    if (!existing.has("status")) sqlite.exec("ALTER TABLE viby_identity_links ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked'))");
    if (!existing.has("link_provenance")) sqlite.exec("ALTER TABLE viby_identity_links ADD COLUMN link_provenance TEXT NOT NULL DEFAULT 'operator'");
    if (!existing.has("environment")) sqlite.exec("ALTER TABLE viby_identity_links ADD COLUMN environment TEXT");
    if (!existing.has("binding_provenance")) sqlite.exec("ALTER TABLE viby_identity_links ADD COLUMN binding_provenance TEXT");
    if (!existing.has("bound_at")) sqlite.exec("ALTER TABLE viby_identity_links ADD COLUMN bound_at INTEGER");
    if (!existing.has("last_authenticated_at")) sqlite.exec("ALTER TABLE viby_identity_links ADD COLUMN last_authenticated_at INTEGER");
    if (!existing.has("link_scope")) {
      sqlite.exec("ALTER TABLE viby_identity_links ADD COLUMN link_scope TEXT NOT NULL DEFAULT 'legacy_admin' CHECK (link_scope IN ('legacy_admin', 'identity'))");
    }
    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS viby_identity_links_application_subject_unique
        ON viby_identity_links(application_id, subject_id);
      CREATE UNIQUE INDEX IF NOT EXISTS viby_identity_links_application_user_unique
        ON viby_identity_links(application_id, local_user_id) WHERE local_user_id IS NOT NULL;
      CREATE TABLE IF NOT EXISTS viby_login_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        state_hash TEXT NOT NULL UNIQUE,
        browser_binding_hash TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('application_login', 'admin_login', 'judge_login')),
        return_to TEXT NOT NULL,
        expected_audience TEXT NOT NULL,
        freshness_required INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER,
        failure_code TEXT
      );
      CREATE INDEX IF NOT EXISTS viby_login_transactions_expires_idx ON viby_login_transactions(expires_at);
      CREATE TABLE IF NOT EXISTS viby_session_handoffs (
        id TEXT PRIMARY KEY NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        transaction_id TEXT NOT NULL REFERENCES viby_login_transactions(id) ON DELETE CASCADE,
        identity_link_id TEXT NOT NULL REFERENCES viby_identity_links(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        viby_subject_hash TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('application_login', 'admin_login', 'judge_login')),
        return_to TEXT NOT NULL,
        verification_kind TEXT CHECK (verification_kind IN ('fresh', 'remembered')),
        verified_at INTEGER,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS viby_session_handoffs_expires_idx ON viby_session_handoffs(expires_at);
      CREATE TABLE IF NOT EXISTS admin_session_provenance (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
        authentication_method TEXT NOT NULL CHECK (authentication_method = 'better_auth_viby'),
        identity_link_id TEXT NOT NULL REFERENCES viby_identity_links(id) ON DELETE RESTRICT,
        viby_subject_hash TEXT NOT NULL,
        operation TEXT NOT NULL DEFAULT 'admin_login'
          CHECK (operation IN ('application_login', 'admin_login', 'judge_login')),
        verification_kind TEXT CHECK (verification_kind IN ('fresh', 'remembered')),
        verified_at INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS admin_session_provenance_link_idx ON admin_session_provenance(identity_link_id);
      CREATE TABLE IF NOT EXISTS viby_identity_link_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        browser_binding_hash TEXT NOT NULL,
        viby_subject TEXT NOT NULL,
        viby_subject_hash TEXT NOT NULL,
        application_id TEXT NOT NULL,
        environment TEXT NOT NULL,
        identity_session_id TEXT NOT NULL,
        verified_at INTEGER NOT NULL,
        assertion_correlation_hash TEXT NOT NULL,
        expected_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        return_to TEXT NOT NULL,
        operation TEXT NOT NULL DEFAULT 'admin_login'
          CHECK (operation IN ('application_login', 'admin_login', 'judge_login')),
        transaction_type TEXT NOT NULL DEFAULT 'create_new_link'
          CHECK (transaction_type IN ('create_new_link', 'claim_unbound_legacy_link')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','failed')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER,
        cancelled_at INTEGER,
        failure_code TEXT
      );
      CREATE INDEX IF NOT EXISTS viby_link_transactions_expires_idx ON viby_identity_link_transactions(expires_at);
      CREATE INDEX IF NOT EXISTS viby_link_transactions_subject_idx ON viby_identity_link_transactions(viby_subject_hash);
      CREATE TABLE IF NOT EXISTS viby_legacy_identity_claims (
        transaction_id TEXT PRIMARY KEY NOT NULL
          REFERENCES viby_identity_link_transactions(id) ON DELETE CASCADE,
        identity_link_id TEXT NOT NULL
          REFERENCES viby_identity_links(id) ON DELETE RESTRICT,
        expected_status TEXT NOT NULL CHECK (expected_status = 'active'),
        expected_user_unbound INTEGER NOT NULL DEFAULT 1 CHECK (expected_user_unbound = 1),
        expected_application_id TEXT NOT NULL,
        expected_environment TEXT NOT NULL,
        expected_subject_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS viby_legacy_claims_link_idx
        ON viby_legacy_identity_claims(identity_link_id);
    `);
    const transactionColumns = columns(sqlite, "viby_identity_link_transactions");
    if (!transactionColumns.has("transaction_type")) {
      sqlite.exec(`
        ALTER TABLE viby_identity_link_transactions
        ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'create_new_link'
          CHECK (transaction_type IN ('create_new_link', 'claim_unbound_legacy_link'))
      `);
    }
    if (!transactionColumns.has("operation")) {
      sqlite.exec(`
        ALTER TABLE viby_identity_link_transactions
        ADD COLUMN operation TEXT NOT NULL DEFAULT 'admin_login'
          CHECK (operation IN ('application_login', 'admin_login', 'judge_login'))
      `);
    }
    validate(sqlite);
  })();
  console.log(`Phase B schema is valid for ${target}.`);
} finally {
  sqlite.close();
}
