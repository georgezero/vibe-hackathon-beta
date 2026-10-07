import Database from "better-sqlite3";
import { accessSync, constants, lstatSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";

if (process.env.NODE_ENV === "production" || process.env.VIBE_EVENT_SIMULATION !== "1") {
  throw new Error("H.2 observation fixtures require VIBE_EVENT_SIMULATION=1 outside production.");
}
const configured = process.env.DB_FILE_NAME?.trim();
if (!configured || !isAbsolute(configured)) throw new Error("DB_FILE_NAME must be an explicit absolute SQLite path.");
const requested = resolve(configured);
const stat = lstatSync(requested);
if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Target must be an existing regular, non-symlink file.");
const target = realpathSync(requested);
if (target !== requested) throw new Error("Target must be its canonical non-symlink path.");
accessSync(target, constants.R_OK | constants.W_OK);
const expected = `SEED H2 OBSERVATION DATABASE ${target}`;
if (process.env.VIBE_H2_OBSERVATION_CONFIRM !== expected) throw new Error(`Confirmation required: ${JSON.stringify(expected)}.`);
const eventId = process.argv[2]?.trim() || "evt_kentucky_vibes";
const sqlite = new Database(target, { fileMustExist: true });
sqlite.pragma("foreign_keys = ON");
if (!sqlite.prepare("SELECT 1 FROM events WHERE id=?").get(eventId)) throw new Error(`Event does not exist: ${eventId}`);
const now = Math.floor(Date.now() / 1000);
const hash = (n: number) => createHash("sha256").update(`h2-observation:${eventId}:${n}`).digest("hex");
const insertEvent = sqlite.prepare("INSERT OR IGNORE INTO participant_journey_events (id,event_id,event_type,participant_hash,device_class,source,destination,outcome,reason,context,duration_ms,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
const insertFeedback = sqlite.prepare("INSERT OR IGNORE INTO participant_feedback (id,event_id,participant_hash,category,context,message,status,created_at,reviewed_at) VALUES (?,?,?,?,?,?,?,?,?)");
try {
  sqlite.transaction(() => {
    const add = (id: string, type: string, participant: number, device: string, source: string | null, destination: string | null, outcome: string | null, reason: string | null, context: string | null, duration: number | null, ageHours: number) => insertEvent.run(id, eventId, type, hash(participant), device, source, destination, outcome, reason, context, duration, now - ageHours * 3600);
    for (let participant = 1; participant <= 8; participant += 1) add(`h2obs_start_${participant}`, "participant_start_viewed", participant, participant % 3 === 0 ? "mobile" : "desktop", "start", "start", "viewed", null, "start", null, participant);
    for (let participant = 1; participant <= 6; participant += 1) { add(`h2obs_project_${participant}`, participant % 2 ? "participant_project_created" : "participant_project_resumed", participant, participant % 3 === 0 ? "mobile" : "desktop", "start", "editor", "success", null, "start", null, participant); add(`h2obs_editor_${participant}`, "participant_editor_viewed", participant, participant % 3 === 0 ? "mobile" : "desktop", "my_projects", "editor", "viewed", null, "editor", 1381, participant); }
    for (let participant = 1; participant <= 4; participant += 1) add(`h2obs_preview_${participant}`, "participant_preview_viewed", participant, participant % 3 === 0 ? "mobile" : "desktop", "editor", "preview", "viewed", null, "preview", 363, participant);
    for (let participant = 1; participant <= 3; participant += 1) add(`h2obs_attempt_${participant}`, "participant_finalization_attempted", participant, "desktop", "preview", "submit", "started", null, "submit", null, participant);
    for (let participant = 1; participant <= 2; participant += 1) add(`h2obs_final_${participant}`, "participant_finalization_succeeded", participant, "desktop", "submit", "submit", "success", null, "submit", 420 + participant * 70, participant);
    add("h2obs_ready_3", "participant_readiness_incomplete", 3, "mobile", "preview", "preview", "guardrail", "readiness_incomplete", "preview", null, 3);
    add("h2obs_stale_4", "participant_stale_edit_detected", 4, "desktop", "editor", "editor", "guardrail", "stale_edit", "editor", null, 4);
    add("h2obs_expired_5", "participant_invitation_expired", 5, "desktop", "invitation", "invitation", "guardrail", "expired_invitation", "invitation", null, 5);
    add("h2obs_validation_6", "participant_save_validation_failed", 6, "mobile", "editor", "editor", "failure", "validation", "editor", null, 6);
    add("h2obs_agent_2", "participant_agent_update_received", 2, "desktop", "editor", "editor", "success", null, "editor", null, 2);
    add("h2obs_invite_1", "participant_invitation_created", 1, "desktop", "team", "invitation", "success", null, "team", null, 2);
    add("h2obs_accept_2", "participant_invitation_accepted", 2, "desktop", "invitation", "workspace", "success", null, "invitation", null, 2);
    add("h2obs_teamchat_2", "participant_team_chat_opened", 2, "desktop", "workspace", "team_chat", "viewed", null, "team_chat", null, 2);
    add("h2obs_people_7", "participant_people_viewed", 7, "desktop", "explore", "people", "viewed", null, "people", null, 1);
    add("h2obs_profile_7", "participant_profile_viewed", 7, "desktop", "people", "people", "viewed", null, "people", null, 1);
    add("h2obs_message_7", "participant_message_initiated", 7, "desktop", "people", "messages", "started", null, "messages", null, 1);
    add("h2obs_community_8", "participant_community_opened", 8, "mobile", "explore", "community", "viewed", null, "community", null, 1);
    add("h2obs_explore_7", "participant_explore_opened", 7, "desktop", "my_projects", "explore", "viewed", null, "explore", null, 1);
    insertFeedback.run("h2obs_feedback_1", eventId, hash(3), "could_not_complete", "editor", "I could not tell which project details were still required.", "new", now - 2 * 3600, null);
    insertFeedback.run("h2obs_feedback_2", eventId, hash(4), "suggestion", "my_projects", "A clearer next step would help when I return to a draft.", "reviewed", now - 5 * 3600, now - 2 * 3600);
    insertFeedback.run("h2obs_feedback_3", eventId, hash(6), "confusing", "invitation", "I was unsure whether accepting changed my team listing or my project access.", "resolved", now - 8 * 3600, now - 3 * 3600);
    insertFeedback.run("h2obs_feedback_4", eventId, hash(8), "other", "community", "The community area was easy to find, but I did not know where to start.", "dismissed", now - 12 * 3600, now - 4 * 3600);
  })();
  const counts = {
    journeyEvents: Number((sqlite.prepare("SELECT count(*) AS count FROM participant_journey_events WHERE event_id=?").get(eventId) as { count: number }).count),
    feedback: Number((sqlite.prepare("SELECT count(*) AS count FROM participant_feedback WHERE event_id=?").get(eventId) as { count: number }).count),
  };
  if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Foreign-key validation failed.");
  console.log(JSON.stringify({ database: target, eventId, deterministic: true, counts, foreignKeyCheck: "passed" }));
} finally { sqlite.close(); }
