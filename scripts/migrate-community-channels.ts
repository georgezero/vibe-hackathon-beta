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
const expected = `MIGRATE COMMUNITY CHANNELS DATABASE ${target}`;
if (process.env.VIBE_F3_MIGRATION_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS community_channels (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'discussion',
        visibility TEXT NOT NULL DEFAULT 'participants',
        posting_policy TEXT NOT NULL DEFAULT 'participants',
        status TEXT NOT NULL DEFAULT 'active',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        CONSTRAINT community_channels_slug_check CHECK (length(slug) BETWEEN 2 AND 40),
        CONSTRAINT community_channels_name_check CHECK (length(name) BETWEEN 1 AND 80),
        CONSTRAINT community_channels_description_check CHECK (length(description) BETWEEN 1 AND 240),
        CONSTRAINT community_channels_type_check CHECK (type IN ('discussion','announcements')),
        CONSTRAINT community_channels_visibility_check CHECK (visibility = 'participants'),
        CONSTRAINT community_channels_policy_check CHECK (posting_policy IN ('participants','admins_only')),
        CONSTRAINT community_channels_status_check CHECK (status IN ('active','archived'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS community_channels_event_slug_unique ON community_channels(event_id, slug);
      CREATE INDEX IF NOT EXISTS community_channels_event_status_idx ON community_channels(event_id, status);
      CREATE INDEX IF NOT EXISTS community_channels_event_sort_idx ON community_channels(event_id, sort_order);

      CREATE TABLE IF NOT EXISTS community_messages (
        id TEXT PRIMARY KEY NOT NULL,
        channel_id TEXT NOT NULL REFERENCES community_channels(id) ON DELETE RESTRICT,
        author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        body TEXT NOT NULL,
        client_message_id TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        removed_at INTEGER,
        removed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT community_messages_body_length_check CHECK (length(body) BETWEEN 1 AND 4000)
      );
      CREATE INDEX IF NOT EXISTS community_messages_channel_created_idx ON community_messages(channel_id, created_at);
      CREATE INDEX IF NOT EXISTS community_messages_author_idx ON community_messages(author_user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS community_messages_client_idempotency_unique ON community_messages(channel_id, author_user_id, client_message_id);

      CREATE TABLE IF NOT EXISTS community_message_events (
        id TEXT PRIMARY KEY NOT NULL,
        channel_id TEXT NOT NULL REFERENCES community_channels(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL,
        message_id TEXT NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
        actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        CONSTRAINT community_message_events_type_check CHECK (event_type = 'message_created')
      );
      CREATE INDEX IF NOT EXISTS community_message_events_channel_idx ON community_message_events(channel_id, id);
      CREATE INDEX IF NOT EXISTS community_message_events_created_idx ON community_message_events(created_at);

      CREATE TABLE IF NOT EXISTS community_channel_read_states (
        id TEXT PRIMARY KEY NOT NULL,
        channel_id TEXT NOT NULL REFERENCES community_channels(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        last_read_message_id TEXT REFERENCES community_messages(id) ON DELETE SET NULL,
        last_read_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS community_channel_read_states_unique ON community_channel_read_states(channel_id, user_id);
      CREATE INDEX IF NOT EXISTS community_channel_read_states_user_idx ON community_channel_read_states(user_id);

      CREATE TABLE IF NOT EXISTS community_message_reports (
        id TEXT PRIMARY KEY NOT NULL,
        channel_id TEXT NOT NULL REFERENCES community_channels(id) ON DELETE RESTRICT,
        message_id TEXT NOT NULL REFERENCES community_messages(id) ON DELETE RESTRICT,
        reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        category TEXT NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        reviewed_at INTEGER,
        reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT community_message_reports_category_check CHECK (category IN ('harassment','spam','off_topic','other')),
        CONSTRAINT community_message_reports_status_check CHECK (status IN ('open','reviewed','dismissed')),
        CONSTRAINT community_message_reports_reason_length_check CHECK (reason IS NULL OR length(reason) <= 500)
      );
      CREATE INDEX IF NOT EXISTS community_message_reports_status_idx ON community_message_reports(status);
      CREATE INDEX IF NOT EXISTS community_message_reports_channel_idx ON community_message_reports(channel_id);
      CREATE INDEX IF NOT EXISTS community_message_reports_message_idx ON community_message_reports(message_id);
    `);
    const foreignKeys = sqlite.pragma("foreign_key_check") as unknown[];
    if (foreignKeys.length) throw new Error("Foreign-key validation failed.");
  })();
  const count = (table: string) => (sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count;
  console.log(JSON.stringify({ database: target, idempotent: true, foreignKeyCheck: "passed", counts: {
    channels: count("community_channels"), messages: count("community_messages"), reports: count("community_message_reports"), readStates: count("community_channel_read_states"),
  }}));
} finally { sqlite.close(); }
