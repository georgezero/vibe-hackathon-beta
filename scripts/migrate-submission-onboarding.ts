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
  const canonical = realpathSync(requested);
  if (canonical !== requested || canonical === protectedBackup) throw new Error("Target must be its canonical non-protected path.");
  accessSync(canonical, constants.R_OK | constants.W_OK);
  return canonical;
}

const target = targetPath();
const expected = `MIGRATE SUBMISSION ONBOARDING DATABASE ${target}`;
if (process.env.VIBE_C1_MIGRATION_CONFIRM !== expected) {
  throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);
}

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  const duplicateOwners = sqlite.prepare(
    "SELECT submission_id FROM submission_owners GROUP BY submission_id HAVING count(*) > 1 LIMIT 1",
  ).get();
  if (duplicateOwners) throw new Error("Cannot add ownership uniqueness: duplicate active submission owners exist.");

  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS submission_owners_submission_unique
        ON submission_owners(submission_id);
      CREATE INDEX IF NOT EXISTS submission_owners_user_idx
        ON submission_owners(user_id);
      CREATE TABLE IF NOT EXISTS submission_claim_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        edit_token_hash TEXT NOT NULL,
        browser_binding_hash TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        confirmed_at INTEGER,
        CONSTRAINT submission_claim_transactions_status_check
          CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired'))
      );
      CREATE INDEX IF NOT EXISTS submission_claim_transactions_submission_idx
        ON submission_claim_transactions(submission_id);
      CREATE INDEX IF NOT EXISTS submission_claim_transactions_token_idx
        ON submission_claim_transactions(edit_token_hash);
      CREATE INDEX IF NOT EXISTS submission_claim_transactions_browser_idx
        ON submission_claim_transactions(browser_binding_hash);
      CREATE INDEX IF NOT EXISTS submission_claim_transactions_status_idx
        ON submission_claim_transactions(status);
      CREATE INDEX IF NOT EXISTS submission_claim_transactions_expires_idx
        ON submission_claim_transactions(expires_at);
    `);
    if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
  })();
  console.log(JSON.stringify({ database: target, idempotent: true, foreignKeyCheck: "passed" }));
} finally {
  sqlite.close();
}
