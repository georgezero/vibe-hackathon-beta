import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const configured = process.env.DB_FILE_NAME?.trim();
if (process.env.DATABASE_URL?.trim()) throw new Error("Remote calibration migration is not supported.");
if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
const target = resolve(configured);
const stat = lstatSync(target);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
const canonical = realpathSync(target);
if (canonical !== target) throw new Error("Target must be canonical and non-symlinked.");
accessSync(canonical, constants.R_OK | constants.W_OK);
const expected = `MIGRATE CALIBRATION DATABASE ${canonical}`;
if (process.env.VIBE_D3_MIGRATION_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);

const sqlite = new Database(canonical, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS calibration_thresholds (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        overall_variance_threshold REAL NOT NULL DEFAULT 64,
        criterion_variance_threshold REAL NOT NULL DEFAULT 4,
        outlier_difference_threshold REAL NOT NULL DEFAULT 20,
        minimum_evaluations INTEGER NOT NULL DEFAULT 2,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT calibration_thresholds_values_check CHECK (overall_variance_threshold > 0 AND criterion_variance_threshold > 0 AND outlier_difference_threshold > 0 AND minimum_evaluations >= 2)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS calibration_thresholds_event_unique ON calibration_thresholds(event_id);
      CREATE TABLE IF NOT EXISTS calibration_consensus_reviews (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'in_review',
        discussion TEXT,
        flagged_reason TEXT,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        completed_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT calibration_consensus_reviews_status_check CHECK (status IN ('in_review','complete','flagged')),
        CONSTRAINT calibration_consensus_reviews_completion_check CHECK ((status = 'complete' AND completed_at IS NOT NULL) OR status <> 'complete')
      );
      CREATE UNIQUE INDEX IF NOT EXISTS calibration_consensus_reviews_event_submission_unique ON calibration_consensus_reviews(event_id, submission_id);
      CREATE INDEX IF NOT EXISTS calibration_consensus_reviews_event_status_idx ON calibration_consensus_reviews(event_id, status);
    `);
    const events = sqlite.prepare("SELECT id FROM events").all() as Array<{ id: string }>;
    const insert = sqlite.prepare("INSERT OR IGNORE INTO calibration_thresholds (id,event_id) VALUES (?,?)");
    for (const event of events) insert.run(`ct_${event.id}`, event.id);
    if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
  })();
  const count = (table: string) => Number((sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count);
  console.log(JSON.stringify({ database: canonical, idempotent: true, foreignKeyCheck: "passed", thresholds: count("calibration_thresholds"), consensusReviews: count("calibration_consensus_reviews") }));
} finally { sqlite.close(); }
