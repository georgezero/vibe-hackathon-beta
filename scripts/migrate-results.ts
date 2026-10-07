import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const configured = process.env.DB_FILE_NAME?.trim();
if (process.env.DATABASE_URL?.trim()) throw new Error("Remote results migration is not supported.");
if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
const target = resolve(configured);
const stat = lstatSync(target);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
const canonical = realpathSync(target);
if (canonical !== target) throw new Error("Target must be canonical and non-symlinked.");
accessSync(canonical, constants.R_OK | constants.W_OK);
const expected = `MIGRATE RESULTS DATABASE ${canonical}`;
if (process.env.VIBE_D2_MIGRATION_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);

const sqlite = new Database(canonical, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS result_tie_reviews (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        tie_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        rationale TEXT,
        resolved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        resolved_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT result_tie_reviews_status_check CHECK (status IN ('pending','resolved')),
        CONSTRAINT result_tie_reviews_lifecycle_check CHECK ((status = 'pending' AND resolved_at IS NULL) OR (status = 'resolved' AND resolved_at IS NOT NULL))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS result_tie_reviews_event_key_unique ON result_tie_reviews(event_id, tie_key);
      CREATE INDEX IF NOT EXISTS result_tie_reviews_event_status_idx ON result_tie_reviews(event_id, status);
      CREATE TABLE IF NOT EXISTS result_tie_review_submissions (
        id TEXT PRIMARY KEY NOT NULL,
        tie_review_id TEXT NOT NULL REFERENCES result_tie_reviews(id) ON DELETE CASCADE,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        score REAL NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS result_tie_review_submissions_unique ON result_tie_review_submissions(tie_review_id, submission_id);
      CREATE INDEX IF NOT EXISTS result_tie_review_submissions_submission_idx ON result_tie_review_submissions(submission_id);
      CREATE TABLE IF NOT EXISTS result_finalists (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'active',
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT result_finalists_status_check CHECK (status IN ('active','removed'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS result_finalists_active_unique ON result_finalists(event_id, submission_id) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS result_finalists_event_status_idx ON result_finalists(event_id, status);
      CREATE TABLE IF NOT EXISTS result_winners (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        category TEXT NOT NULL,
        award_label TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT result_winners_category_check CHECK (category IN ('grand_prize','runner_up','honorable_mention','custom')),
        CONSTRAINT result_winners_status_check CHECK (status IN ('active','removed')),
        CONSTRAINT result_winners_custom_label_check CHECK ((category = 'custom' AND award_label IS NOT NULL) OR category <> 'custom')
      );
      CREATE UNIQUE INDEX IF NOT EXISTS result_winners_active_category_unique ON result_winners(event_id, category) WHERE status = 'active';
      CREATE UNIQUE INDEX IF NOT EXISTS result_winners_active_submission_category_unique ON result_winners(event_id, submission_id, category) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS result_winners_event_status_idx ON result_winners(event_id, status);
      CREATE TABLE IF NOT EXISTS result_publication_states (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'calculated',
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        published_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT result_publication_states_status_check CHECK (status IN ('calculated','reviewed','published')),
        CONSTRAINT result_publication_states_published_at_check CHECK ((status = 'published' AND published_at IS NOT NULL) OR (status <> 'published' AND published_at IS NULL))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS result_publication_states_event_unique ON result_publication_states(event_id);
      CREATE INDEX IF NOT EXISTS result_publication_states_status_idx ON result_publication_states(status);
    `);
    const events = sqlite.prepare("SELECT id, winners_published_at FROM events").all() as Array<{ id: string; winners_published_at: number | null }>;
    const insert = sqlite.prepare("INSERT OR IGNORE INTO result_publication_states (id, event_id, status, published_at) VALUES (?, ?, ?, ?)");
    for (const event of events) insert.run(`rps_${event.id}`, event.id, event.winners_published_at ? "published" : "calculated", event.winners_published_at ?? null);
    if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
  })();
  const count = (table: string) => Number((sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count);
  console.log(JSON.stringify({ database: canonical, idempotent: true, foreignKeyCheck: "passed", tieReviews: count("result_tie_reviews"), finalists: count("result_finalists"), winners: count("result_winners"), publicationStates: count("result_publication_states") }));
} finally {
  sqlite.close();
}
