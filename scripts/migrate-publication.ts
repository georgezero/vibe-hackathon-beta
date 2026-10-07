import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const configured = process.env.DB_FILE_NAME?.trim();
if (process.env.DATABASE_URL?.trim()) throw new Error("Remote publication migration is not supported.");
if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
const target = resolve(configured);
const stat = lstatSync(target);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
const canonical = realpathSync(target);
if (canonical !== target) throw new Error("Target must be canonical and non-symlinked.");
accessSync(canonical, constants.R_OK | constants.W_OK);
const expected = `MIGRATE PUBLICATION DATABASE ${canonical}`;
if (process.env.VIBE_D4_MIGRATION_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);

const sqlite = new Database(canonical, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS publication_releases (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'calculated',
        publication_mode TEXT NOT NULL DEFAULT 'awards_only',
        show_scores INTEGER NOT NULL DEFAULT 1,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        approved_at INTEGER,
        published_at INTEGER,
        archived_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT publication_releases_status_check CHECK (status IN ('calculated','reviewed','approved','published','archived')),
        CONSTRAINT publication_releases_mode_check CHECK (publication_mode IN ('awards_only','awards_feedback','feedback_later','everything'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS publication_releases_event_unique ON publication_releases(event_id);
      CREATE INDEX IF NOT EXISTS publication_releases_status_idx ON publication_releases(status);
      CREATE TABLE IF NOT EXISTS publication_qualification_releases (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        fixture_marker TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'calculated',
        publication_mode TEXT NOT NULL DEFAULT 'awards_only',
        show_scores INTEGER NOT NULL DEFAULT 1,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        approved_at INTEGER,
        published_at INTEGER,
        archived_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT publication_qualification_releases_marker_check CHECK (fixture_marker = 'd4-publication-qualification'),
        CONSTRAINT publication_qualification_releases_status_check CHECK (status IN ('calculated','reviewed','approved','published','archived')),
        CONSTRAINT publication_qualification_releases_mode_check CHECK (publication_mode IN ('awards_only','awards_feedback','feedback_later','everything'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS publication_qualification_releases_event_submission_unique ON publication_qualification_releases(event_id, submission_id);
      CREATE INDEX IF NOT EXISTS publication_qualification_releases_status_idx ON publication_qualification_releases(status);
      CREATE INDEX IF NOT EXISTS publication_qualification_releases_submission_idx ON publication_qualification_releases(submission_id);
      CREATE TABLE IF NOT EXISTS publication_qualification_revisions (
        id TEXT PRIMARY KEY NOT NULL,
        release_id TEXT NOT NULL REFERENCES publication_qualification_releases(id) ON DELETE RESTRICT,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        publication_mode TEXT NOT NULL,
        show_scores INTEGER NOT NULL,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT publication_qualification_revisions_status_check CHECK (status IN ('calculated','reviewed','approved','published','archived')),
        CONSTRAINT publication_qualification_revisions_mode_check CHECK (publication_mode IN ('awards_only','awards_feedback','feedback_later','everything'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS publication_qualification_revisions_release_revision_unique ON publication_qualification_revisions(release_id, revision);
      CREATE INDEX IF NOT EXISTS publication_qualification_revisions_submission_created_idx ON publication_qualification_revisions(submission_id, created_at);
      CREATE TABLE IF NOT EXISTS publication_qualification_announcements (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        markdown TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        published_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT publication_qualification_announcements_status_check CHECK (status IN ('draft','published','withdrawn'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS publication_qualification_announcements_event_submission_unique ON publication_qualification_announcements(event_id, submission_id);
      CREATE INDEX IF NOT EXISTS publication_qualification_announcements_submission_idx ON publication_qualification_announcements(submission_id);
      CREATE TABLE IF NOT EXISTS publication_revisions (
        id TEXT PRIMARY KEY NOT NULL,
        release_id TEXT NOT NULL REFERENCES publication_releases(id) ON DELETE RESTRICT,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        publication_mode TEXT NOT NULL,
        show_scores INTEGER NOT NULL,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        reason TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT publication_revisions_status_check CHECK (status IN ('calculated','reviewed','approved','published','archived')),
        CONSTRAINT publication_revisions_mode_check CHECK (publication_mode IN ('awards_only','awards_feedback','feedback_later','everything'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS publication_revisions_release_revision_unique ON publication_revisions(release_id, revision);
      CREATE INDEX IF NOT EXISTS publication_revisions_event_created_idx ON publication_revisions(event_id, created_at);
      CREATE TABLE IF NOT EXISTS publication_awards (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        category TEXT NOT NULL,
        label TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT publication_awards_status_check CHECK (status IN ('active','removed'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS publication_awards_active_category_unique ON publication_awards(event_id, category) WHERE status = 'active';
      CREATE UNIQUE INDEX IF NOT EXISTS publication_awards_active_submission_category_unique ON publication_awards(event_id, submission_id, category) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS publication_awards_event_status_idx ON publication_awards(event_id, status);
      CREATE TABLE IF NOT EXISTS publication_feedback (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
        administrator_summary TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        released_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT publication_feedback_event_submission_unique UNIQUE (event_id, submission_id),
        CONSTRAINT publication_feedback_status_check CHECK (status IN ('draft','released','withdrawn')),
        CONSTRAINT publication_feedback_release_check CHECK ((status = 'released' AND released_at IS NOT NULL) OR status <> 'released')
      );
      CREATE INDEX IF NOT EXISTS publication_feedback_event_status_idx ON publication_feedback(event_id, status);
      CREATE TABLE IF NOT EXISTS publication_feedback_comments (
        id TEXT PRIMARY KEY NOT NULL,
        feedback_id TEXT NOT NULL REFERENCES publication_feedback(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        source_judge_id TEXT REFERENCES judges(id) ON DELETE SET NULL,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        released_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT publication_feedback_comments_status_check CHECK (status IN ('draft','released','withdrawn')),
        CONSTRAINT publication_feedback_comments_release_check CHECK ((status = 'released' AND released_at IS NOT NULL) OR status <> 'released')
      );
      CREATE INDEX IF NOT EXISTS publication_feedback_comments_feedback_idx ON publication_feedback_comments(feedback_id);
      CREATE TABLE IF NOT EXISTS publication_announcements (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        markdown TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        published_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT publication_announcements_event_unique UNIQUE (event_id),
        CONSTRAINT publication_announcements_status_check CHECK (status IN ('draft','published','withdrawn'))
      );
    `);
    const events = sqlite.prepare("SELECT id FROM events").all() as Array<{ id: string }>;
    const releaseInsert = sqlite.prepare("INSERT OR IGNORE INTO publication_releases (id,event_id,status,published_at) VALUES (?,?,?,?)");
    for (const event of events) {
      // D.4 is a new participant-visibility boundary. Legacy D.2 state is
      // preserved in its own table, but it must never implicitly publish the
      // new projection. An administrator must review and publish explicitly.
      releaseInsert.run(`pr_${event.id}`, event.id, "calculated", null);
    }
    const releases = sqlite.prepare("SELECT id,event_id,status,publication_mode,show_scores,actor_user_id,updated_at FROM publication_releases").all() as Array<{ id: string; event_id: string; status: string; publication_mode: string; show_scores: number; actor_user_id: string | null; updated_at: number }>;
    const revisionInsert = sqlite.prepare("INSERT OR IGNORE INTO publication_revisions (id,release_id,event_id,revision,status,publication_mode,show_scores,actor_user_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)");
    for (const release of releases) revisionInsert.run(`pvr_${release.id}_1`, release.id, release.event_id, 1, release.status, release.publication_mode, release.show_scores, release.actor_user_id, release.updated_at);
    const winners = sqlite.prepare("SELECT id,event_id,submission_id,category,award_label,actor_user_id,created_at,updated_at FROM result_winners WHERE status='active'").all() as Array<{ id: string; event_id: string; submission_id: string; category: string; award_label: string | null; actor_user_id: string | null; created_at: number; updated_at: number }>;
    const awardInsert = sqlite.prepare("INSERT OR IGNORE INTO publication_awards (id,event_id,submission_id,category,label,status,actor_user_id,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?,?)");
    for (const winner of winners) awardInsert.run(`pa_${winner.id}`, winner.event_id, winner.submission_id, winner.category, winner.award_label || winner.category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), winner.actor_user_id, winner.created_at, winner.updated_at);
    if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
  })();
  const count = (table: string) => Number((sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count);
  console.log(JSON.stringify({ database: canonical, idempotent: true, foreignKeyCheck: "passed", releases: count("publication_releases"), qualificationReleases: count("publication_qualification_releases"), revisions: count("publication_revisions"), qualificationRevisions: count("publication_qualification_revisions"), qualificationAnnouncements: count("publication_qualification_announcements"), awards: count("publication_awards"), feedback: count("publication_feedback"), announcements: count("publication_announcements") }));
} finally { sqlite.close(); }
