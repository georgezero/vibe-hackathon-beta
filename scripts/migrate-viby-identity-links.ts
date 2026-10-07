import Database from "better-sqlite3";
import path from "node:path";

const fileName = process.env.DB_FILE_NAME?.trim() || "";
const productionConfirmation = "CREATE_VIBY_IDENTITY_LINKS";
if (!fileName || !path.isAbsolute(fileName)) {
  throw new Error("Refusing to migrate an unspecified or relative database path.");
}
if (
  process.env.NODE_ENV === "production"
  && process.env.VIBE_IDENTITY_LINK_MIGRATION_CONFIRM !== productionConfirmation
) {
  throw new Error(`Production migration requires VIBE_IDENTITY_LINK_MIGRATION_CONFIRM=${productionConfirmation}.`);
}

const sqlite = new Database(fileName);
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS viby_identity_links (
      id TEXT PRIMARY KEY NOT NULL,
      provider_id TEXT NOT NULL DEFAULT 'viby',
      subject_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin')),
      local_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      display_name TEXT NOT NULL,
      last_verified_at INTEGER NOT NULL,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS viby_identity_links_provider_subject_role_unique
      ON viby_identity_links(provider_id, subject_id, role);
    CREATE INDEX IF NOT EXISTS viby_identity_links_role_idx
      ON viby_identity_links(role);
  `);
  const integrity = sqlite.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") throw new Error(`Integrity check failed: ${String(integrity)}`);
  console.log(JSON.stringify({ table: "viby_identity_links", integrity: "ok" }));
} finally {
  sqlite.close();
}
