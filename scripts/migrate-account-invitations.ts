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

function tableExists(sqlite: Database.Database, table: string) {
  return Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function validate(sqlite: Database.Database) {
  const expectedColumns = [
    "id", "user_id", "token_hash", "status", "grant_admin", "grant_judge",
    "judge_profile_id", "event_id", "invited_by_user_id", "expires_at",
    "accepted_at", "expired_at", "revoked_at", "created_at", "updated_at",
  ];
  const columns = (sqlite.prepare("PRAGMA table_info(account_invitations)").all() as Array<{ name: string }>).map((row) => row.name);
  if (columns.length !== expectedColumns.length || columns.some((column, index) => column !== expectedColumns[index])) {
    throw new Error("account_invitations has an incompatible column set.");
  }
  const requiredForeignKeys = [
    ["user_id", "users", "id", "RESTRICT"],
    ["judge_profile_id", "judges", "id", "RESTRICT"],
    ["event_id", "events", "id", "RESTRICT"],
    ["invited_by_user_id", "users", "id", "SET NULL"],
  ] as const;
  const foreignKeys = sqlite.prepare("PRAGMA foreign_key_list(account_invitations)").all() as Array<{ from: string; table: string; to: string; on_delete: string }>;
  for (const [from, table, to, onDelete] of requiredForeignKeys) {
    if (!foreignKeys.some((fk) => fk.from === from && fk.table === table && fk.to === to && fk.on_delete === onDelete)) {
      throw new Error(`Invitation foreign key is incompatible: ${from}.`);
    }
  }
  for (const index of [
    "account_invitations_token_hash_unique", "account_invitations_user_idx",
    "account_invitations_status_idx", "account_invitations_expires_idx",
    "account_invitations_event_idx", "account_invitations_pending_user_unique",
    "account_invitations_pending_judge_unique",
  ]) {
    if (!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(index)) {
      throw new Error(`Invitation index is missing: ${index}.`);
    }
  }
  const bridgeColumns = (sqlite.prepare("PRAGMA table_info(account_invitation_viby_transactions)").all() as Array<{ name: string }>).map((row) => row.name);
  if (bridgeColumns.join(",") !== "login_transaction_id,invitation_id,link_transaction_id,created_at") {
    throw new Error("account_invitation_viby_transactions has an incompatible column set.");
  }
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
}

const target = targetPath();
const expectedConfirmation = `MIGRATE ACCOUNT INVITATIONS DATABASE ${target}`;
if (process.env.VIBE_ACCOUNT_INVITATIONS_MIGRATION_CONFIRM !== expectedConfirmation) {
  throw new Error(`Confirmation required: ${JSON.stringify(expectedConfirmation)}.`);
}

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  for (const table of ["users", "events", "judges", "admin_authorizations", "judge_authorizations", "audit_events", "viby_login_transactions", "viby_identity_link_transactions"]) {
    if (!tableExists(sqlite, table)) throw new Error(`Target is missing required application table: ${table}.`);
  }
  const before = tableExists(sqlite, "account_invitations")
    ? Number((sqlite.prepare("SELECT count(*) count FROM account_invitations").get() as { count: number }).count)
    : 0;
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS account_invitations (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        token_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        grant_admin INTEGER NOT NULL DEFAULT 0,
        grant_judge INTEGER NOT NULL DEFAULT 0,
        judge_profile_id TEXT REFERENCES judges(id) ON DELETE RESTRICT,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        invited_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        expires_at INTEGER NOT NULL,
        accepted_at INTEGER,
        expired_at INTEGER,
        revoked_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT account_invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
        CONSTRAINT account_invitations_judge_intent_check CHECK (
          (grant_judge = 0 AND judge_profile_id IS NULL)
          OR (grant_judge = 1 AND judge_profile_id IS NOT NULL)
        ),
        CONSTRAINT account_invitations_lifecycle_check CHECK (
          (status = 'pending' AND accepted_at IS NULL AND expired_at IS NULL AND revoked_at IS NULL)
          OR (status = 'accepted' AND accepted_at IS NOT NULL AND expired_at IS NULL AND revoked_at IS NULL)
          OR (status = 'expired' AND accepted_at IS NULL AND expired_at IS NOT NULL AND revoked_at IS NULL)
          OR (status = 'revoked' AND accepted_at IS NULL AND revoked_at IS NOT NULL)
        )
      );
      CREATE UNIQUE INDEX IF NOT EXISTS account_invitations_token_hash_unique ON account_invitations(token_hash);
      CREATE INDEX IF NOT EXISTS account_invitations_user_idx ON account_invitations(user_id);
      CREATE INDEX IF NOT EXISTS account_invitations_status_idx ON account_invitations(status);
      CREATE INDEX IF NOT EXISTS account_invitations_expires_idx ON account_invitations(expires_at);
      CREATE INDEX IF NOT EXISTS account_invitations_event_idx ON account_invitations(event_id);
      CREATE UNIQUE INDEX IF NOT EXISTS account_invitations_pending_user_unique
        ON account_invitations(user_id) WHERE status = 'pending';
      CREATE UNIQUE INDEX IF NOT EXISTS account_invitations_pending_judge_unique
        ON account_invitations(judge_profile_id, event_id)
        WHERE status = 'pending' AND grant_judge = 1;
      CREATE TABLE IF NOT EXISTS account_invitation_viby_transactions (
        login_transaction_id TEXT PRIMARY KEY NOT NULL
          REFERENCES viby_login_transactions(id) ON DELETE CASCADE,
        invitation_id TEXT NOT NULL
          REFERENCES account_invitations(id) ON DELETE RESTRICT,
        link_transaction_id TEXT
          REFERENCES viby_identity_link_transactions(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS account_invitation_viby_link_unique
        ON account_invitation_viby_transactions(link_transaction_id);
      CREATE INDEX IF NOT EXISTS account_invitation_viby_invitation_idx
        ON account_invitation_viby_transactions(invitation_id);
    `);
    validate(sqlite);
  })();
  const after = Number((sqlite.prepare("SELECT count(*) count FROM account_invitations").get() as { count: number }).count);
  console.log(JSON.stringify({ database: target, invitationsBefore: before, invitationsAfter: after, automaticRowsCreated: after - before, foreignKeyCheck: "passed" }));
} finally {
  sqlite.close();
}
