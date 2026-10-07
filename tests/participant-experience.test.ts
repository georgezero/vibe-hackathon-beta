import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, describe, expect, it } from "vitest";
import {
  PARTICIPANT_JOURNEY_EVENT_TYPES,
  participantExperienceWindowBounds,
  participantHash,
  recordParticipantJourneyEvent,
  createParticipantFeedback,
  feedbackMessageIsValid,
  getParticipantExperienceData,
  purgeParticipantExperienceData,
} from "@/lib/participant-experience";
import { ADMIN_API_POLICIES } from "@/lib/admin-api-policy";

describe("H.2 participant experience telemetry", () => {
  let createdSharedUsersTable = false;
  let createdSharedEventsTable = false;
  let createdSharedSubmissionsTable = false;
  let createdSharedInvitationsTable = false;
  const aggregateRows = { submissionId: "sub_aggregate", invitationId: "invite_aggregate" };
  function ensureUsersTableForFeedback() {
    const database = process.env.DB_FILE_NAME!;
    const sqlite = new Database(database);
    const exists = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!exists) {
      sqlite.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");
      createdSharedUsersTable = true;
    }
    sqlite.close();
  }

  function ensureEvent(eventId: string) {
    const database = process.env.DB_FILE_NAME!;
    const sqlite = new Database(database);
    const hadEventsTable = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='events'").get();
    sqlite.exec("CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY)");
    if (!hadEventsTable) createdSharedEventsTable = true;
    const columns = (sqlite.prepare("PRAGMA table_info(events)").all() as Array<{ name: string }>).map((column) => column.name);
    if (columns.includes("name") && columns.includes("slug")) {
      sqlite.prepare("INSERT OR IGNORE INTO events (id, name, slug) VALUES (?, ?, ?)").run(eventId, "H.2 Synthetic Event", `h2-${eventId}`);
    } else {
      sqlite.prepare("INSERT OR IGNORE INTO events (id) VALUES (?)").run(eventId);
    }
    sqlite.close();
  }

  function ensureNullableColumns(table: string, columns: Record<string, string>) {
    const sqlite = new Database(process.env.DB_FILE_NAME!);
    const existing = new Set(
      (sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name),
    );
    for (const [name, type] of Object.entries(columns)) {
      if (!existing.has(name)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    }
    sqlite.close();
  }

  afterAll(() => {
    const sqlite = new Database(process.env.DB_FILE_NAME!);
    sqlite.pragma("foreign_keys=ON");
    if (createdSharedEventsTable) {
      sqlite.exec("DELETE FROM participant_feedback; DELETE FROM participant_journey_events; DROP TABLE IF EXISTS events");
    }
    if (sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='submission_membership_invitations'").get()) {
      sqlite.prepare("DELETE FROM submission_membership_invitations WHERE id=?").run(aggregateRows.invitationId);
    }
    if (sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='submissions'").get()) {
      sqlite.prepare("DELETE FROM submissions WHERE id=?").run(aggregateRows.submissionId);
    }
    if (createdSharedInvitationsTable) sqlite.exec("DROP TABLE IF EXISTS submission_membership_invitations");
    if (createdSharedSubmissionsTable) sqlite.exec("DROP TABLE IF EXISTS submissions");
    if (createdSharedUsersTable) sqlite.exec("DROP TABLE IF EXISTS users");
    sqlite.close();
  });

  it("uses a fixed taxonomy and one-way event-scoped participant digest", () => {
    expect(PARTICIPANT_JOURNEY_EVENT_TYPES).toContain("participant_preview_viewed");
    expect(PARTICIPANT_JOURNEY_EVENT_TYPES).not.toContain("click");
    const digest = participantHash("evt_test", "user_private");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain("user_private");
  });

  it("calculates bounded server-time windows", () => {
    const now = new Date("2026-08-10T15:30:00.000Z");
    expect(participantExperienceWindowBounds("last_24_hours", now).start.toISOString()).toBe("2026-08-09T15:30:00.000Z");
    expect(participantExperienceWindowBounds("today", now).start.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("runs the additive migration twice without records or FK errors", () => {
    const root = mkdtempSync(join(tmpdir(), "vibe-h2-migration-"));
    const database = join(root, "application.db");
    const sqlite = new Database(database);
    sqlite.exec("PRAGMA foreign_keys=ON; CREATE TABLE events (id TEXT PRIMARY KEY); INSERT INTO events (id) VALUES ('evt_test');");
    sqlite.close();
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DB_FILE_NAME: database, VIBE_TEST_DATABASE_ROOT: root, DATABASE_URL: "", VIBE_H2_MIGRATION_CONFIRM: `MIGRATE H2 PARTICIPANT EXPERIENCE DATABASE ${database}` };
    const args = ["tsx", "scripts/migrate-participant-experience.ts"];
    const first = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    const second = execFileSync("npx", args, { cwd: process.cwd(), env, encoding: "utf8" });
    expect(JSON.parse(first)).toMatchObject({ idempotent: true, foreignKeyCheck: "passed", counts: { journeyEvents: 0, feedback: 0 } });
    expect(JSON.parse(second)).toEqual(JSON.parse(first));
    const check = new Database(database, { readonly: true });
    expect(check.pragma("foreign_key_check")).toEqual([]);
    expect(check.prepare("SELECT count(*) AS count FROM participant_journey_events").get()).toEqual({ count: 0 });
    expect(check.prepare("SELECT count(*) AS count FROM participant_feedback").get()).toEqual({ count: 0 });
    check.close();
  }, 15_000);

  it("records only a valid bounded event and does not block on invalid taxonomy", async () => {
    const root = process.env.VIBE_TEST_DATABASE_ROOT!;
    const database = process.env.DB_FILE_NAME!;
    ensureEvent("evt_test");
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DB_FILE_NAME: database, VIBE_TEST_DATABASE_ROOT: root, DATABASE_URL: "", VIBE_H2_MIGRATION_CONFIRM: `MIGRATE H2 PARTICIPANT EXPERIENCE DATABASE ${database}` };
    execFileSync("npx", ["tsx", "scripts/migrate-participant-experience.ts"], { cwd: process.cwd(), env });
    expect(await recordParticipantJourneyEvent({ eventId: "evt_test", eventType: "participant_preview_viewed", participantUserId: "user_private", deviceClass: "mobile", destination: "preview", outcome: "viewed" })).toBe(true);
    expect(await recordParticipantJourneyEvent({ eventId: "evt_test", eventType: "participant_project_resumed", context: "resume", source: "resume", destination: "editor", outcome: "success" })).toBe(true);
    expect(await recordParticipantJourneyEvent({ eventId: "evt_test", eventType: "not_a_real_event" as never })).toBe(false);
    const check = new Database(database, { readonly: true });
    const row = check.prepare("SELECT event_id, event_type, participant_hash, device_class, destination, outcome FROM participant_journey_events").get() as { event_id: string; event_type: string; participant_hash: string; device_class: string; destination: string; outcome: string };
    expect(row).toMatchObject({ event_id: "evt_test", event_type: "participant_preview_viewed", participant_hash: expect.stringMatching(/^[0-9a-f]{64}$/), device_class: "mobile", destination: "preview", outcome: "viewed" });
    check.close();
  });

  it("keeps feedback bounded and purges only H.2 data past its retention windows", async () => {
    const database = process.env.DB_FILE_NAME!;
    ensureUsersTableForFeedback();
    ensureEvent("evt_retention");
    const now = new Date("2026-08-10T12:00:00.000Z");
    expect(feedbackMessageIsValid(" ")).toBe(false);
    expect(feedbackMessageIsValid("bounded note")).toBe(true);
    expect(await recordParticipantJourneyEvent({ eventId: "evt_retention", eventType: "participant_start_viewed", participantUserId: "retention-user", occurredAt: new Date("2026-05-01T00:00:00.000Z") })).toBe(true);
    expect(await recordParticipantJourneyEvent({ eventId: "evt_retention", eventType: "participant_start_viewed", participantUserId: "retention-user", occurredAt: new Date("2026-08-09T00:00:00.000Z") })).toBe(true);
    const feedbackId = await createParticipantFeedback({ eventId: "evt_retention", participantUserId: "retention-user", category: "suggestion", context: "start", message: "Retained until the feedback window ends." });
    expect(feedbackId).toMatch(/^pf_/);
    const writable = new Database(database);
    writable.prepare("UPDATE participant_feedback SET created_at=? WHERE id=?").run(Math.floor(new Date("2026-01-01T00:00:00.000Z").getTime() / 1000), feedbackId);
    writable.close();
    await purgeParticipantExperienceData(now);
    const check = new Database(database, { readonly: true });
    expect(check.prepare("SELECT count(*) AS count FROM participant_journey_events WHERE event_id='evt_retention'").get()).toEqual({ count: 1 });
    expect(check.prepare("SELECT count(*) AS count FROM participant_feedback WHERE id=?").get(feedbackId)).toEqual({ count: 0 });
    check.close();
  });

  it("aggregates one event only, keeps cross-event rows out, and rate-limits feedback", async () => {
    const database = process.env.DB_FILE_NAME!;
    const root = process.env.VIBE_TEST_DATABASE_ROOT!;
    ensureUsersTableForFeedback();
    ensureEvent("evt_aggregate");
    ensureEvent("evt_other");
    const sqlite = new Database(database);
    createdSharedSubmissionsTable = !sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='submissions'").get();
    createdSharedInvitationsTable = !sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='submission_membership_invitations'").get();
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, event_id TEXT, status TEXT, created_at INTEGER, finalized_at INTEGER);
      CREATE TABLE IF NOT EXISTS submission_membership_invitations (id TEXT PRIMARY KEY, submission_id TEXT, status TEXT, created_at INTEGER, accepted_at INTEGER);
    `);
    sqlite.close();
    ensureNullableColumns("submissions", { event_id: "TEXT", status: "TEXT", created_at: "INTEGER", finalized_at: "INTEGER" });
    ensureNullableColumns("submission_membership_invitations", { submission_id: "TEXT", status: "TEXT", created_at: "INTEGER", accepted_at: "INTEGER" });
    const nowSeconds = Math.floor(Date.now() / 1000);
    const writable = new Database(database);
    writable.prepare("INSERT OR IGNORE INTO submissions (id) VALUES (?)").run(aggregateRows.submissionId);
    writable.prepare("UPDATE submissions SET event_id=?, status=?, created_at=?, finalized_at=? WHERE id=?").run("evt_aggregate", "finalized", nowSeconds, nowSeconds, aggregateRows.submissionId);
    writable.prepare("INSERT OR IGNORE INTO submission_membership_invitations (id) VALUES (?)").run(aggregateRows.invitationId);
    writable.prepare("UPDATE submission_membership_invitations SET submission_id=?, status=?, created_at=?, accepted_at=? WHERE id=?").run(aggregateRows.submissionId, "accepted", nowSeconds, nowSeconds, aggregateRows.invitationId);
    writable.close();
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DB_FILE_NAME: database, VIBE_TEST_DATABASE_ROOT: root, DATABASE_URL: "", VIBE_H2_MIGRATION_CONFIRM: `MIGRATE H2 PARTICIPANT EXPERIENCE DATABASE ${database}` };
    execFileSync("npx", ["tsx", "scripts/migrate-participant-experience.ts"], { cwd: process.cwd(), env });
    await recordParticipantJourneyEvent({ eventId: "evt_aggregate", eventType: "participant_start_viewed", participantUserId: "user_aggregate", context: "start", destination: "start", outcome: "viewed" });
    await recordParticipantJourneyEvent({ eventId: "evt_aggregate", eventType: "participant_project_created", participantUserId: "user_aggregate", context: "start", destination: "editor", outcome: "success" });
    await recordParticipantJourneyEvent({ eventId: "evt_aggregate", eventType: "participant_preview_viewed", participantUserId: "user_aggregate", context: "preview", destination: "preview", outcome: "viewed" });
    await recordParticipantJourneyEvent({ eventId: "evt_other", eventType: "participant_start_viewed", participantUserId: "user_aggregate", context: "start", destination: "start", outcome: "viewed" });
    const now = new Date();
    const data = await getParticipantExperienceData({ eventId: "evt_aggregate", window: "event_to_date", now });
    expect(data.overview.participantsWithActivity).toBe(1);
    expect(data.funnel.find((row) => row.key === "preview")?.participants).toBe(1);
    expect(data.overview.projectsStarted).toBe(1);
    expect(data.overview.invitationsAccepted).toBe(1);
    expect(JSON.stringify(data)).not.toContain("user_aggregate");
    expect(JSON.stringify(data)).not.toContain("participantHash");
    for (let i = 0; i < 3; i += 1) expect(await createParticipantFeedback({ eventId: "evt_aggregate", participantUserId: "user_aggregate", category: "suggestion", context: "my_projects", message: `Synthetic note ${i}` })).toMatch(/^pf_/);
    expect(await createParticipantFeedback({ eventId: "evt_aggregate", participantUserId: "user_aggregate", category: "suggestion", context: "my_projects", message: "One too many" })).toBe("rate_limited");
  });

  it("keeps participant experience APIs administrator-only", () => {
    expect(ADMIN_API_POLICIES["GET /api/admin/participant-experience"].access).toBe("authenticated-admin");
    expect(ADMIN_API_POLICIES["PATCH /api/admin/participant-experience/feedback/[feedbackId]"].access).toBe("authenticated-admin");
    expect(ADMIN_API_POLICIES["PATCH /api/admin/participant-experience/feedback/[feedbackId]"].mutation).toBe(true);
  });
});
