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

function columns(sqlite: Database.Database, table: string) {
  return new Set(
    (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>)
      .map((row) => row.name),
  );
}

function tableSql(sqlite: Database.Database, table: string) {
  return String((sqlite.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table) as { sql?: string } | undefined)?.sql ?? "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function requirePhaseB(sqlite: Database.Database) {
  for (const table of [
    "users",
    "sessions",
    "viby_identity_links",
    "viby_login_transactions",
    "viby_session_handoffs",
    "admin_session_provenance",
    "viby_identity_link_transactions",
  ]) {
    if (!tableExists(sqlite, table)) {
      throw new Error(`Target is not a Phase B database; missing ${table}.`);
    }
  }
}

function hasRoleNeutralOperationCheck(sql: string) {
  return sql.includes("operation in ('admin_login', 'judge_login')")
    || sql.includes("operation in ('application_login', 'admin_login', 'judge_login')");
}

function rebuildOperationTables(sqlite: Database.Database) {
  const loginSql = tableSql(sqlite, "viby_login_transactions");
  const handoffSql = tableSql(sqlite, "viby_session_handoffs");
  if (
    hasRoleNeutralOperationCheck(loginSql)
    && hasRoleNeutralOperationCheck(handoffSql)
  ) {
    return;
  }

  sqlite.exec(`
    ALTER TABLE viby_session_handoffs RENAME TO viby_session_handoffs_b44_old;
    ALTER TABLE viby_login_transactions RENAME TO viby_login_transactions_b44_old;

    CREATE TABLE viby_login_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      state_hash TEXT NOT NULL UNIQUE,
      browser_binding_hash TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('admin_login', 'judge_login')),
      return_to TEXT NOT NULL,
      expected_audience TEXT NOT NULL,
      freshness_required INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER,
      failure_code TEXT
    );
    INSERT INTO viby_login_transactions
      SELECT id, state_hash, browser_binding_hash, operation, return_to,
             expected_audience, freshness_required, created_at, expires_at,
             consumed_at, failure_code
      FROM viby_login_transactions_b44_old;
    CREATE TABLE viby_session_handoffs (
      id TEXT PRIMARY KEY NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      transaction_id TEXT NOT NULL REFERENCES viby_login_transactions(id) ON DELETE CASCADE,
      identity_link_id TEXT NOT NULL REFERENCES viby_identity_links(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viby_subject_hash TEXT NOT NULL,
      operation TEXT NOT NULL CHECK (operation IN ('admin_login', 'judge_login')),
      return_to TEXT NOT NULL,
      verification_kind TEXT CHECK (verification_kind IN ('fresh', 'remembered')),
      verified_at INTEGER,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
    INSERT INTO viby_session_handoffs (
      id, token_hash, transaction_id, identity_link_id, user_id,
      viby_subject_hash, operation, return_to, verification_kind, verified_at,
      created_at, expires_at, consumed_at
    )
    SELECT id, token_hash, transaction_id, identity_link_id, user_id,
           viby_subject_hash, operation, return_to, NULL, NULL,
           created_at, expires_at, consumed_at
    FROM viby_session_handoffs_b44_old;
    DROP TABLE viby_session_handoffs_b44_old;
    DROP TABLE viby_login_transactions_b44_old;
    CREATE INDEX viby_login_transactions_expires_idx
      ON viby_login_transactions(expires_at);
    CREATE INDEX viby_session_handoffs_expires_idx
      ON viby_session_handoffs(expires_at);
  `);
}

function addColumns(sqlite: Database.Database) {
  const links = columns(sqlite, "viby_identity_links");
  if (!links.has("link_scope")) {
    sqlite.exec(`
      ALTER TABLE viby_identity_links
      ADD COLUMN link_scope TEXT NOT NULL DEFAULT 'legacy_admin'
        CHECK (link_scope IN ('legacy_admin', 'identity'))
    `);
  }

  const handoffs = columns(sqlite, "viby_session_handoffs");
  if (!handoffs.has("verification_kind")) {
    sqlite.exec(`
      ALTER TABLE viby_session_handoffs
      ADD COLUMN verification_kind TEXT
        CHECK (verification_kind IN ('fresh', 'remembered'))
    `);
  }
  if (!handoffs.has("verified_at")) {
    sqlite.exec("ALTER TABLE viby_session_handoffs ADD COLUMN verified_at INTEGER");
  }

  const provenance = columns(sqlite, "admin_session_provenance");
  if (!provenance.has("operation")) {
    sqlite.exec(`
      ALTER TABLE admin_session_provenance
      ADD COLUMN operation TEXT NOT NULL DEFAULT 'admin_login'
        CHECK (operation IN ('admin_login', 'judge_login'))
    `);
  }
  if (!provenance.has("verification_kind")) {
    sqlite.exec(`
      ALTER TABLE admin_session_provenance
      ADD COLUMN verification_kind TEXT
        CHECK (verification_kind IN ('fresh', 'remembered'))
    `);
  }
  if (!provenance.has("verified_at")) {
    sqlite.exec("ALTER TABLE admin_session_provenance ADD COLUMN verified_at INTEGER");
  }

  const pending = columns(sqlite, "viby_identity_link_transactions");
  if (!pending.has("operation")) {
    sqlite.exec(`
      ALTER TABLE viby_identity_link_transactions
      ADD COLUMN operation TEXT NOT NULL DEFAULT 'admin_login'
        CHECK (operation IN ('admin_login', 'judge_login'))
    `);
  }
}

function validate(sqlite: Database.Database) {
  if (!hasRoleNeutralOperationCheck(tableSql(sqlite, "viby_login_transactions"))) {
    throw new Error("Login transactions do not enforce the B.4.4 operation enum.");
  }
  if (!hasRoleNeutralOperationCheck(tableSql(sqlite, "viby_session_handoffs"))) {
    throw new Error("Session handoffs do not enforce the B.4.4 operation enum.");
  }
  for (const [table, required] of Object.entries({
    viby_identity_links: ["link_scope"],
    viby_session_handoffs: ["verification_kind", "verified_at"],
    admin_session_provenance: ["operation", "verification_kind", "verified_at"],
    viby_identity_link_transactions: ["operation"],
  })) {
    const actual = columns(sqlite, table);
    for (const column of required) {
      if (!actual.has(column)) throw new Error(`Missing ${table}.${column}.`);
    }
  }
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) {
    throw new Error("Foreign-key validation failed.");
  }
}

const target = targetPath();
const expected = `MIGRATE VIBY JUDGE LOGIN DATABASE ${target}`;
if (process.env.VIBE_PHASE_B44_MIGRATION_CONFIRM !== expected) {
  throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);
}

const sqlite = new Database(target, { fileMustExist: true });
try {
  requirePhaseB(sqlite);
  sqlite.pragma("foreign_keys = OFF");
  sqlite.transaction(() => {
    rebuildOperationTables(sqlite);
    addColumns(sqlite);
  })();
  sqlite.pragma("foreign_keys = ON");
  validate(sqlite);
  console.log(`Phase B.4.4 schema is valid for ${target}.`);
} finally {
  sqlite.close();
}
