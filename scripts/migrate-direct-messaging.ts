import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

function targetPath() {
  if (process.env.DATABASE_URL?.trim()) throw new Error("Remote DATABASE_URL migration is not supported.");
  const configured = process.env.DB_FILE_NAME?.trim();
  if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
  const requested = resolve(configured);
  const stat = lstatSync(requested);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
  const canonical = realpathSync(requested);
  if (canonical !== requested) throw new Error("Target must be its canonical non-symlink path.");
  accessSync(canonical, constants.R_OK | constants.W_OK);
  return canonical;
}

const target = targetPath();
const expected = `MIGRATE DIRECT MESSAGING DATABASE ${target}`;
if (process.env.VIBE_F2_MIGRATION_CONFIRM !== expected) {
  throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);
}

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS direct_conversations (
        id TEXT PRIMARY KEY NOT NULL,
        participant_a_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        participant_b_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT direct_conversations_distinct_check CHECK (participant_a_user_id <> participant_b_user_id),
        CONSTRAINT direct_conversations_order_check CHECK (participant_a_user_id < participant_b_user_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS direct_conversations_pair_unique ON direct_conversations(participant_a_user_id, participant_b_user_id);
      CREATE INDEX IF NOT EXISTS direct_conversations_a_idx ON direct_conversations(participant_a_user_id);
      CREATE INDEX IF NOT EXISTS direct_conversations_b_idx ON direct_conversations(participant_b_user_id);
      CREATE TRIGGER IF NOT EXISTS direct_conversations_order_guard_insert
        BEFORE INSERT ON direct_conversations
        WHEN NEW.participant_a_user_id >= NEW.participant_b_user_id
        BEGIN SELECT RAISE(ABORT, 'direct conversation participants must be canonical'); END;
      CREATE TRIGGER IF NOT EXISTS direct_conversations_order_guard_update
        BEFORE UPDATE OF participant_a_user_id, participant_b_user_id ON direct_conversations
        WHEN NEW.participant_a_user_id >= NEW.participant_b_user_id
        BEGIN SELECT RAISE(ABORT, 'direct conversation participants must be canonical'); END;

      CREATE TABLE IF NOT EXISTS direct_conversation_members (
        id TEXT PRIMARY KEY NOT NULL,
        conversation_id TEXT NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS direct_conversation_members_unique ON direct_conversation_members(conversation_id, user_id);
      CREATE INDEX IF NOT EXISTS direct_conversation_members_user_idx ON direct_conversation_members(user_id);

      CREATE TABLE IF NOT EXISTS direct_messages (
        id TEXT PRIMARY KEY NOT NULL,
        conversation_id TEXT NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT,
        author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        body TEXT NOT NULL,
        client_message_id TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT direct_messages_body_length_check CHECK (length(body) BETWEEN 1 AND 4000)
      );
      CREATE INDEX IF NOT EXISTS direct_messages_conversation_created_idx ON direct_messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS direct_messages_author_idx ON direct_messages(author_user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS direct_messages_client_idempotency_unique ON direct_messages(conversation_id, author_user_id, client_message_id);

      CREATE TABLE IF NOT EXISTS direct_message_read_states (
        id TEXT PRIMARY KEY NOT NULL,
        conversation_id TEXT NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        last_read_message_id TEXT REFERENCES direct_messages(id) ON DELETE SET NULL,
        last_read_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS direct_message_read_states_unique ON direct_message_read_states(conversation_id, user_id);
      CREATE INDEX IF NOT EXISTS direct_message_read_states_user_idx ON direct_message_read_states(user_id);

      CREATE TABLE IF NOT EXISTS direct_message_events (
        id TEXT PRIMARY KEY NOT NULL,
        conversation_id TEXT NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL,
        message_id TEXT NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
        actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT direct_message_events_type_check CHECK (event_type = 'message_created')
      );
      CREATE INDEX IF NOT EXISTS direct_message_events_conversation_idx ON direct_message_events(conversation_id, id);
      CREATE INDEX IF NOT EXISTS direct_message_events_created_idx ON direct_message_events(created_at);

      CREATE TABLE IF NOT EXISTS participant_blocks (
        blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT participant_blocks_distinct_check CHECK (blocker_user_id <> blocked_user_id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS participant_blocks_pair_unique ON participant_blocks(blocker_user_id, blocked_user_id);
      CREATE INDEX IF NOT EXISTS participant_blocks_blocked_idx ON participant_blocks(blocked_user_id);

      CREATE TABLE IF NOT EXISTS direct_message_reports (
        id TEXT PRIMARY KEY NOT NULL,
        conversation_id TEXT NOT NULL REFERENCES direct_conversations(id) ON DELETE RESTRICT,
        reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        category TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT direct_message_reports_category_check CHECK (category IN ('harassment', 'spam', 'other')),
        CONSTRAINT direct_message_reports_status_check CHECK (status IN ('open', 'reviewed', 'dismissed')),
        CONSTRAINT direct_message_reports_reason_length_check CHECK (reason IS NULL OR length(reason) <= 500)
      );
      CREATE INDEX IF NOT EXISTS direct_message_reports_status_idx ON direct_message_reports(status);
      CREATE INDEX IF NOT EXISTS direct_message_reports_conversation_idx ON direct_message_reports(conversation_id);

      CREATE TABLE IF NOT EXISTS participant_messaging_preferences (
        user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        allow_incoming TEXT NOT NULL DEFAULT 'participants',
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT participant_messaging_preferences_allow_check CHECK (allow_incoming IN ('participants', 'none'))
      );
    `);
    const foreignKeys = sqlite.pragma("foreign_key_check") as unknown[];
    if (foreignKeys.length) throw new Error("Foreign-key validation failed.");
  })();

  const count = (table: string) => (sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count;
  console.log(JSON.stringify({
    database: target,
    idempotent: true,
    foreignKeyCheck: "passed",
    counts: {
      conversations: count("direct_conversations"),
      messages: count("direct_messages"),
      blocks: count("participant_blocks"),
      reports: count("direct_message_reports"),
    },
  }));
} finally {
  sqlite.close();
}
