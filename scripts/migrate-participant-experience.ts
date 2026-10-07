import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

function targetPath() {
  if (process.env.DATABASE_URL?.trim()) throw new Error("Remote participant-experience migration is not supported.");
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
const expected = `MIGRATE H2 PARTICIPANT EXPERIENCE DATABASE ${target}`;
if (process.env.VIBE_H2_MIGRATION_CONFIRM !== expected) {
  throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);
}

const sqlite = new Database(target, { fileMustExist: true });
try {
  sqlite.pragma("foreign_keys = ON");
  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS participant_journey_events (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL,
        participant_hash TEXT,
        device_class TEXT NOT NULL DEFAULT 'unknown',
        source TEXT,
        destination TEXT,
        outcome TEXT,
        reason TEXT,
        context TEXT,
        duration_ms INTEGER,
        occurred_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        CONSTRAINT participant_journey_events_type_check CHECK (event_type IN ('participant_start_viewed','participant_project_created','participant_project_resumed','participant_project_claim_started','participant_project_claim_completed','participant_project_claim_failed','participant_my_projects_viewed','participant_project_opened','participant_next_action_followed','participant_editor_viewed','participant_draft_saved','participant_save_validation_failed','participant_stale_edit_detected','participant_agent_instructions_revealed','participant_agent_handoff_copied','participant_agent_update_received','participant_agent_update_rejected','participant_returned_to_preview','participant_preview_viewed','participant_readiness_incomplete','participant_readiness_complete','participant_finalization_confirmation_opened','participant_finalization_attempted','participant_finalization_succeeded','participant_finalization_rejected','participant_receipt_viewed','participant_invitation_created','participant_invitation_accepted','participant_invitation_expired','participant_invitation_revoked','participant_invitation_wrong_account','participant_project_access_revoked','participant_people_viewed','participant_messages_viewed','participant_profile_viewed','participant_message_initiated','participant_dm_created','participant_community_opened','participant_community_channel_opened','participant_community_message_posted','participant_team_chat_opened','participant_team_chat_message_posted','participant_explore_opened','participant_navigation_destination_selected','participant_workspace_returned')),
        CONSTRAINT participant_journey_events_device_check CHECK (device_class IN ('desktop','mobile','unknown')),
        CONSTRAINT participant_journey_events_source_check CHECK (source IS NULL OR source IN ('start','resume','my_projects','editor','preview','team','invitation','team_chat','people','messages','community','explore','workspace','submit','unknown')),
        CONSTRAINT participant_journey_events_destination_check CHECK (destination IS NULL OR destination IN ('start','resume','my_projects','editor','preview','team','invitation','team_chat','people','messages','community','explore','workspace','submit','status','ai_evals','results','unknown')),
        CONSTRAINT participant_journey_events_outcome_check CHECK (outcome IS NULL OR outcome IN ('success','failure','guardrail','viewed','started','abandoned')),
        CONSTRAINT participant_journey_events_reason_check CHECK (reason IS NULL OR reason IN ('readiness_incomplete','validation','stale_edit','deadline','frozen','expired_invitation','revoked_invitation','wrong_account','unauthorized','rate_limited','duplicate_retry','invalid_token','unknown')),
        CONSTRAINT participant_journey_events_context_check CHECK (context IS NULL OR context IN ('start','resume','my_projects','editor','preview','team','invitation','workspace','people','messages','community','team_chat','explore','submit','unknown')),
        CONSTRAINT participant_journey_events_duration_check CHECK (duration_ms IS NULL OR (duration_ms >= 0 AND duration_ms <= 86400000)),
        CONSTRAINT participant_journey_events_participant_hash_check CHECK (participant_hash IS NULL OR (participant_hash NOT GLOB '*[^0-9a-f]*' AND length(participant_hash) BETWEEN 16 AND 64))
      );
      CREATE INDEX IF NOT EXISTS participant_journey_events_event_time_idx ON participant_journey_events(event_id, occurred_at);
      CREATE INDEX IF NOT EXISTS participant_journey_events_event_type_idx ON participant_journey_events(event_id, event_type, occurred_at);
      CREATE INDEX IF NOT EXISTS participant_journey_events_participant_idx ON participant_journey_events(event_id, participant_hash, occurred_at);

      CREATE TABLE IF NOT EXISTS participant_feedback (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
        participant_hash TEXT,
        category TEXT NOT NULL,
        context TEXT NOT NULL DEFAULT 'unknown',
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        reviewed_at INTEGER,
        reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT participant_feedback_category_check CHECK (category IN ('confusing','could_not_complete','broken','suggestion','other')),
        CONSTRAINT participant_feedback_context_check CHECK (context IN ('start','resume','my_projects','editor','preview','team','invitation','workspace','people','messages','community','team_chat','explore','submit','unknown')),
        CONSTRAINT participant_feedback_participant_hash_check CHECK (participant_hash IS NULL OR (participant_hash NOT GLOB '*[^0-9a-f]*' AND length(participant_hash) BETWEEN 16 AND 64)),
        CONSTRAINT participant_feedback_status_check CHECK (status IN ('new','reviewed','resolved','dismissed')),
        CONSTRAINT participant_feedback_message_length_check CHECK (length(trim(message)) BETWEEN 1 AND 1000),
        CONSTRAINT participant_feedback_review_check CHECK ((status = 'new' AND reviewed_at IS NULL) OR (status <> 'new' AND reviewed_at IS NOT NULL))
      );
      CREATE INDEX IF NOT EXISTS participant_feedback_event_status_idx ON participant_feedback(event_id, status, created_at);
      CREATE INDEX IF NOT EXISTS participant_feedback_event_time_idx ON participant_feedback(event_id, created_at);
    `);
    const foreignKeys = sqlite.pragma("foreign_key_check") as unknown[];
    if (foreignKeys.length) throw new Error("Foreign-key validation failed.");
  })();
  const count = (table: string) => Number((sqlite.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count);
  console.log(JSON.stringify({
    database: target,
    idempotent: true,
    foreignKeyCheck: "passed",
    counts: {
      journeyEvents: count("participant_journey_events"),
      feedback: count("participant_feedback"),
    },
  }));
} finally {
  sqlite.close();
}
