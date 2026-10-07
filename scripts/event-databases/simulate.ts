import Database from "better-sqlite3";
import { existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { SNAPSHOT_DIR, ensureDir, inspectDatabase, onlineBackup, parseArg, resolveArtifact, setImmutableMode, fsyncDir, fsyncPath, sha256, verifySummary, writeChecksum, writeMetadata } from "./common";

const scenarios = ["healthy-event", "operations-stress", "calibration-challenge", "publication-rehearsal"] as const;
type Scenario = typeof scenarios[number];
function scenarioArg() { return parseArg("--scenario") || process.argv[3] || "healthy-event"; }
function fixtureSubmissionIds(db: Database.Database) { return (db.prepare("SELECT root_id id FROM event_fixture_records WHERE event_id='evt_kentucky_vibes' AND root_type='submission' ORDER BY root_id").all() as Array<{ id: string }>).map((r) => r.id); }
async function main() {
  if (process.env.VIBE_EVENT_SIMULATION !== "1" && process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") throw new Error("Synthetic simulation requires VIBE_EVENT_SIMULATION=1 or NODE_ENV=development/test.");
  const input = process.argv[2] || "kentucky-vibes-base"; const scenario = scenarioArg() as Scenario; if (!scenarios.includes(scenario)) throw new Error(`Scenario must be one of ${scenarios.join(", ")}.`);
  const base = resolveArtifact(input); const baseSummary = inspectDatabase(base); verifySummary(baseSummary); if (baseSummary.event?.slug !== "kentucky-vibes") throw new Error("Simulation source must be the kentucky-vibes artifact.");
  const seed = Number(parseArg("--seed") || 20260802); const target = resolve(parseArg("--output") || join(SNAPSHOT_DIR, `kentucky-vibes-${scenario}-${seed}.sqlite`)); if (existsSync(target)) throw new Error(`Refusing to overwrite simulation artifact: ${target}`); ensureDir(SNAPSHOT_DIR); await onlineBackup(base, target, { immutable: false });
  const db = new Database(target); db.pragma("foreign_keys=ON"); const now = Math.floor(new Date("2026-08-02T18:00:00Z").getTime() / 1000);
  try {
    db.transaction(() => {
      const assignments = db.prepare("SELECT ja.id,jes.status FROM judge_assignments ja JOIN judging_evaluation_states jes ON jes.assignment_id=ja.id JOIN event_fixture_records fr ON fr.root_id=ja.submission_id WHERE fr.event_id='evt_kentucky_vibes' AND fr.root_type='submission' ORDER BY ja.id").all() as Array<{ id: string; status: string }>;
      const updateState = db.prepare("UPDATE judging_evaluation_states SET status=?, reason=?, updated_at=? WHERE assignment_id=?");
      if (scenario === "healthy-event") {
        assignments.slice(250).forEach((row, i) => updateState.run(i % 2 ? "draft" : "not_started", "Healthy rehearsal residual work", now, row.id));
      } else if (scenario === "operations-stress") {
        assignments.slice(0, 40).forEach((row, i) => updateState.run(i % 3 ? "draft" : "not_started", "Operations stress fixture", now - 86400 * (i % 3), row.id));
        db.prepare("UPDATE judging_assignment_states SET conflict_status='replacement_required', reason='Synthetic conflict coverage gap', updated_at=? WHERE assignment_id IN (SELECT root_id FROM event_fixture_records WHERE event_id='evt_kentucky_vibes' AND root_type='assignment' ORDER BY root_id LIMIT 5)").run(now);
      } else if (scenario === "calibration-challenge") {
        db.prepare("UPDATE human_scores SET problem_selection=CASE WHEN judge_id LIKE '%judge_0001' THEN 10 ELSE 4 END, functionality=CASE WHEN judge_id LIKE '%judge_0001' THEN 10 ELSE 3 END, updated_at=? WHERE submission_id IN (SELECT root_id FROM event_fixture_records WHERE event_id='evt_kentucky_vibes' AND root_type='submission' ORDER BY root_id LIMIT 12)").run(now);
        const ids = fixtureSubmissionIds(db); for (const submissionId of ids.slice(0, 12)) db.prepare("INSERT OR IGNORE INTO calibration_consensus_reviews (id,event_id,submission_id,status,discussion,started_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(`scenario_ccr_${submissionId}`, "evt_kentucky_vibes", submissionId, "flagged", "Calibration challenge fixture", now, now, now);
      } else if (scenario === "publication-rehearsal") {
        const ids = fixtureSubmissionIds(db); for (const submissionId of ids.slice(0, 3)) { db.prepare("INSERT OR IGNORE INTO publication_qualification_releases (id,event_id,submission_id,fixture_marker,status,publication_mode,show_scores,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(`scenario_pqr_${submissionId}`, "evt_kentucky_vibes", submissionId, "d4-publication-qualification", "calculated", "everything", 1, now); db.prepare("INSERT OR IGNORE INTO publication_qualification_revisions (id,release_id,event_id,submission_id,revision,status,publication_mode,show_scores,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(`scenario_pqv_${submissionId}`, `scenario_pqr_${submissionId}`, "evt_kentucky_vibes", submissionId, 1, "calculated", "everything", 1, "Publication rehearsal; unpublished", now); db.prepare("INSERT OR IGNORE INTO publication_awards (id,event_id,submission_id,category,label,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)").run(`scenario_award_${submissionId}`, "evt_kentucky_vibes", submissionId, "synthetic-rehearsal", "Kentucky Vibes Rehearsal Award", "active", now, now); }
      }
    })();
  } finally { db.close(); }
  const finalized = new Database(target); try { finalized.pragma("wal_checkpoint(TRUNCATE)"); finalized.pragma("journal_mode=DELETE"); } finally { finalized.close(); }
  for (const sidecar of [`${target}-wal`, `${target}-shm`, `${target}-journal`]) if (existsSync(sidecar)) unlinkSync(sidecar);
  const summary = inspectDatabase(target); verifySummary(summary); setImmutableMode(target); fsyncPath(target); fsyncDir(SNAPSHOT_DIR); writeChecksum(target); writeMetadata(target, { generatedAtUtc: new Date().toISOString(), sourceBase: base, sourceChecksum: sha256(base), artifact: target, checksum: summary.checksum, scenario, seed, simulationVersion: "e0.0.1", event: summary.event, counts: summary.counts, publicationDefault: "unpublished" });
  console.log(JSON.stringify({ scenario, artifact: target, checksum: summary.checksum, counts: summary.counts, integrity: summary.integrity, foreignKeys: summary.foreignKeys }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
