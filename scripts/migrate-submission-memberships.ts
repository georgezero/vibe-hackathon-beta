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
const expected = `MIGRATE SUBMISSION MEMBERSHIPS DATABASE ${target}`;
if (process.env.VIBE_C2A_MIGRATION_CONFIRM !== expected) {
  throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);
}

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  const duplicateOwners = sqlite.prepare(
    "SELECT submission_id FROM submission_owners GROUP BY submission_id HAVING count(*) > 1 LIMIT 1",
  ).get() as { submission_id?: string } | undefined;
  if (duplicateOwners) throw new Error("Cannot reconcile memberships: duplicate submission owner rows exist.");

  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS submission_membership_invitations (
        id TEXT PRIMARY KEY NOT NULL,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        intended_member_id TEXT REFERENCES team_members(id) ON DELETE SET NULL,
        token_hash TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL DEFAULT 'teammate',
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at INTEGER NOT NULL,
        accepted_at INTEGER,
        revoked_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT submission_membership_invitations_role_check CHECK (role = 'teammate'),
        CONSTRAINT submission_membership_invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
        CONSTRAINT submission_membership_invitations_lifecycle_check CHECK (
          (status = 'pending' AND accepted_at IS NULL AND revoked_at IS NULL)
          OR (status = 'accepted' AND accepted_at IS NOT NULL AND revoked_at IS NULL)
          OR (status IN ('revoked', 'expired') AND revoked_at IS NOT NULL)
        )
      );
      CREATE INDEX IF NOT EXISTS submission_membership_invitations_submission_idx ON submission_membership_invitations(submission_id);
      CREATE INDEX IF NOT EXISTS submission_membership_invitations_status_idx ON submission_membership_invitations(status);
      CREATE INDEX IF NOT EXISTS submission_membership_invitations_expires_idx ON submission_membership_invitations(expires_at);
      CREATE UNIQUE INDEX IF NOT EXISTS submission_membership_invitations_pending_member_unique
        ON submission_membership_invitations(submission_id, intended_member_id)
        WHERE status = 'pending' AND intended_member_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS submission_memberships (
        id TEXT PRIMARY KEY NOT NULL,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        invitation_id TEXT REFERENCES submission_membership_invitations(id) ON DELETE RESTRICT,
        invited_at INTEGER,
        joined_at INTEGER,
        revoked_at INTEGER,
        revoked_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        revocation_reason TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT submission_memberships_role_check CHECK (role IN ('owner', 'teammate')),
        CONSTRAINT submission_memberships_status_check CHECK (status IN ('invited', 'active', 'revoked')),
        CONSTRAINT submission_memberships_lifecycle_check CHECK (
          (status IN ('invited', 'active') AND revoked_at IS NULL)
          OR (status = 'revoked' AND revoked_at IS NOT NULL)
        ),
        CONSTRAINT submission_memberships_role_invitation_check CHECK (
          (role = 'owner' AND invitation_id IS NULL)
          OR (role = 'teammate' AND invitation_id IS NOT NULL)
        )
      );
      CREATE INDEX IF NOT EXISTS submission_memberships_submission_idx ON submission_memberships(submission_id);
      CREATE INDEX IF NOT EXISTS submission_memberships_user_idx ON submission_memberships(user_id);
      CREATE INDEX IF NOT EXISTS submission_memberships_status_idx ON submission_memberships(status);
      CREATE INDEX IF NOT EXISTS submission_memberships_invitation_idx ON submission_memberships(invitation_id);
      CREATE UNIQUE INDEX IF NOT EXISTS submission_memberships_active_user_submission_unique
        ON submission_memberships(submission_id, user_id)
        WHERE status = 'active';
      CREATE UNIQUE INDEX IF NOT EXISTS submission_memberships_active_owner_submission_unique
        ON submission_memberships(submission_id)
        WHERE status = 'active' AND role = 'owner';
    `);

    sqlite.prepare(`
      INSERT INTO submission_memberships
        (id, submission_id, user_id, role, status, joined_at, created_at, updated_at)
      SELECT
        'membership_owner_' || owners.id,
        owners.submission_id,
        owners.user_id,
        'owner',
        'active',
        COALESCE(owners.created_at, strftime('%s', 'now')),
        COALESCE(owners.created_at, strftime('%s', 'now')),
        strftime('%s', 'now')
      FROM submission_owners owners
      WHERE NOT EXISTS (
        SELECT 1 FROM submission_memberships memberships
        WHERE memberships.submission_id = owners.submission_id
          AND memberships.user_id = owners.user_id
          AND memberships.role = 'owner'
          AND memberships.status = 'active'
      )
    `).run();

    if ((sqlite.pragma("foreign_key_check") as unknown[]).length) {
      throw new Error("Foreign-key validation failed.");
    }
  })();

  const counts = {
    owners: (sqlite.prepare("SELECT count(*) AS count FROM submission_owners").get() as { count: number }).count,
    activeOwners: (sqlite.prepare("SELECT count(*) AS count FROM submission_memberships WHERE role = 'owner' AND status = 'active'").get() as { count: number }).count,
    activeMemberships: (sqlite.prepare("SELECT count(*) AS count FROM submission_memberships WHERE status = 'active'").get() as { count: number }).count,
  };
  console.log(JSON.stringify({ database: target, idempotent: true, foreignKeyCheck: "passed", counts }));
} finally {
  sqlite.close();
}
