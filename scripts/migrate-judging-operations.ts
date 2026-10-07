import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const protectedBackup = resolve(process.cwd(), "local.db.pre-p0-4.bak");
const configured = process.env.DB_FILE_NAME?.trim();
if (process.env.DATABASE_URL?.trim()) throw new Error("Remote database migration is not supported.");
if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
const target = resolve(configured);
if (target === protectedBackup) throw new Error("The protected backup cannot be migrated.");
const stat = lstatSync(target);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
const canonical = realpathSync(target);
if (canonical !== target || canonical === protectedBackup) throw new Error("Target must be canonical and non-protected.");
accessSync(canonical, constants.R_OK | constants.W_OK);
const expected = `MIGRATE JUDGING OPERATIONS DATABASE ${canonical}`;
if (process.env.VIBE_D1_MIGRATION_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);

const sqlite = new Database(canonical, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS judging_assignment_states (
        id TEXT PRIMARY KEY NOT NULL,
        assignment_id TEXT NOT NULL REFERENCES judge_assignments(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'active',
        conflict_status TEXT NOT NULL DEFAULT 'clear',
        replacement_assignment_id TEXT,
        reason TEXT,
        changed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        changed_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT judging_assignment_states_status_check CHECK (status IN ('active','superseded','removed')),
        CONSTRAINT judging_assignment_states_conflict_check CHECK (conflict_status IN ('clear','declared','recused','withdrawn','replacement_required'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS judging_assignment_states_assignment_unique ON judging_assignment_states(assignment_id);
      CREATE INDEX IF NOT EXISTS judging_assignment_states_status_idx ON judging_assignment_states(status);
      CREATE INDEX IF NOT EXISTS judging_assignment_states_conflict_idx ON judging_assignment_states(conflict_status);
      CREATE TABLE IF NOT EXISTS judging_evaluation_states (
        id TEXT PRIMARY KEY NOT NULL,
        assignment_id TEXT NOT NULL REFERENCES judge_assignments(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'not_started',
        reason TEXT,
        frozen_at INTEGER,
        reopened_at INTEGER,
        changed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        changed_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT judging_evaluation_states_status_check CHECK (status IN ('not_started','draft','submitted','frozen','reopened'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS judging_evaluation_states_assignment_unique ON judging_evaluation_states(assignment_id);
      CREATE INDEX IF NOT EXISTS judging_evaluation_states_status_idx ON judging_evaluation_states(status);
    `);
    const assignments = sqlite.prepare("SELECT id FROM judge_assignments").all() as Array<{ id: string }>;
    const scores = new Map((sqlite.prepare("SELECT judge_id, submission_id, completed FROM human_scores").all() as Array<{ judge_id: string; submission_id: string; completed: number }>).map((row) => [`${row.judge_id}:${row.submission_id}`, row]));
    const assignmentRows = sqlite.prepare("SELECT id, judge_id, submission_id FROM judge_assignments").all() as Array<{ id: string; judge_id: string; submission_id: string }>;
    const addAssignmentState = sqlite.prepare("INSERT OR IGNORE INTO judging_assignment_states (id, assignment_id) VALUES (?, ?)");
    const addEvaluationState = sqlite.prepare("INSERT OR IGNORE INTO judging_evaluation_states (id, assignment_id, status) VALUES (?, ?, ?)");
    for (const assignment of assignments) addAssignmentState.run(`jas_${assignment.id}`, assignment.id);
    for (const assignment of assignmentRows) {
      const score = scores.get(`${assignment.judge_id}:${assignment.submission_id}`);
      addEvaluationState.run(`jes_${assignment.id}`, assignment.id, score ? (score.completed ? "submitted" : "draft") : "not_started");
    }
    if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
  })();
  const count = (table: string) => Number((sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count);
  console.log(JSON.stringify({ database: canonical, idempotent: true, foreignKeyCheck: "passed", assignmentStates: count("judging_assignment_states"), evaluationStates: count("judging_evaluation_states") }));
} finally {
  sqlite.close();
}
