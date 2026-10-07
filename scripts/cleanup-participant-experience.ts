import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const configured = process.env.DB_FILE_NAME?.trim();
if (process.env.DATABASE_URL?.trim()) throw new Error("Remote participant-experience cleanup is not supported.");
if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
const requested = resolve(configured);
const stat = lstatSync(requested);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
const target = realpathSync(requested);
if (target !== requested) throw new Error("Target must be its canonical non-symlink path.");
accessSync(target, constants.R_OK | constants.W_OK);
const expected = `CLEANUP H2 PARTICIPANT EXPERIENCE DATABASE ${target}`;
if (process.env.VIBE_H2_CLEANUP_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);

const now = Date.now();
const telemetryCutoff = now - 90 * 24 * 60 * 60 * 1000;
const feedbackCutoff = now - 180 * 24 * 60 * 60 * 1000;
const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  const result = sqlite.transaction(() => {
    const telemetry = sqlite.prepare("DELETE FROM participant_journey_events WHERE occurred_at < ?").run(Math.floor(telemetryCutoff / 1000));
    const feedback = sqlite.prepare("DELETE FROM participant_feedback WHERE created_at < ?").run(Math.floor(feedbackCutoff / 1000));
    return { telemetry: telemetry.changes, feedback: feedback.changes };
  })();
  const foreignKeys = sqlite.pragma("foreign_key_check") as unknown[];
  if (foreignKeys.length) throw new Error("Foreign-key validation failed.");
  console.log(JSON.stringify({ database: target, telemetryCutoff: new Date(telemetryCutoff).toISOString(), feedbackCutoff: new Date(feedbackCutoff).toISOString(), deleted: result, foreignKeyCheck: "passed" }));
} finally {
  sqlite.close();
}
