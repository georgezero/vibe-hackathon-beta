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
const expected = `MIGRATE NATIVE CHAT DATABASE ${target}`;
if (process.env.VIBE_C2B_MIGRATION_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id TEXT PRIMARY KEY NOT NULL,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        type TEXT NOT NULL DEFAULT 'submission_private',
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        archived_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT chat_rooms_type_check CHECK (type = 'submission_private'),
        CONSTRAINT chat_rooms_status_check CHECK (status IN ('active', 'archived')),
        CONSTRAINT chat_rooms_lifecycle_check CHECK (
          (status = 'active' AND archived_at IS NULL)
          OR (status = 'archived' AND archived_at IS NOT NULL)
        )
      );
      CREATE INDEX IF NOT EXISTS chat_rooms_submission_idx ON chat_rooms(submission_id);
      CREATE INDEX IF NOT EXISTS chat_rooms_status_idx ON chat_rooms(status);
      CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_active_submission_unique ON chat_rooms(submission_id) WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY NOT NULL,
        room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE RESTRICT,
        author_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        message_type TEXT NOT NULL,
        body TEXT NOT NULL,
        client_message_id TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        edited_at INTEGER,
        deleted_at INTEGER,
        CONSTRAINT chat_messages_type_check CHECK (message_type IN ('user_message', 'system_event')),
        CONSTRAINT chat_messages_author_check CHECK (message_type = 'system_event' OR author_user_id IS NOT NULL),
        CONSTRAINT chat_messages_body_length_check CHECK (length(body) BETWEEN 1 AND 4000)
      );
      CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx ON chat_messages(room_id, created_at);
      CREATE INDEX IF NOT EXISTS chat_messages_author_idx ON chat_messages(author_user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_client_idempotency_unique ON chat_messages(room_id, author_user_id, client_message_id);

      CREATE TABLE IF NOT EXISTS chat_read_states (
        id TEXT PRIMARY KEY NOT NULL,
        room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        last_read_message_id TEXT,
        last_read_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS chat_read_states_room_user_unique ON chat_read_states(room_id, user_id);
      CREATE INDEX IF NOT EXISTS chat_read_states_user_idx ON chat_read_states(user_id);

      CREATE TABLE IF NOT EXISTS chat_events (
        id TEXT PRIMARY KEY NOT NULL,
        room_id TEXT NOT NULL REFERENCES chat_rooms(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL,
        message_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT chat_events_type_check CHECK (event_type IN ('message_created', 'membership_revoked', 'room_archived'))
      );
      CREATE INDEX IF NOT EXISTS chat_events_room_id_idx ON chat_events(room_id, id);
      CREATE INDEX IF NOT EXISTS chat_events_created_idx ON chat_events(created_at);
    `);
    if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
  })();
  const counts = {
    rooms: (sqlite.prepare("SELECT count(*) AS count FROM chat_rooms").get() as { count: number }).count,
    messages: (sqlite.prepare("SELECT count(*) AS count FROM chat_messages").get() as { count: number }).count,
    readStates: (sqlite.prepare("SELECT count(*) AS count FROM chat_read_states").get() as { count: number }).count,
    events: (sqlite.prepare("SELECT count(*) AS count FROM chat_events").get() as { count: number }).count,
  };
  console.log(JSON.stringify({ database: target, idempotent: true, foreignKeyCheck: "passed", counts }));
} finally {
  sqlite.close();
}
