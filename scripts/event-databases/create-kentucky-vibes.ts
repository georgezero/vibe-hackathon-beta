import Database from "better-sqlite3";
import { hashPassword } from "better-auth/crypto";
import { writeFileSync, chmodSync, existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { SNAPSHOT_DIR, assertNotCanonical, assertSchemaCompatible, ensureDir, inspectDatabase, nowUtcStamp, onlineBackup, setImmutableMode, fsyncPath, fsyncDir, resolveArtifact, sha256, verifySummary, writeChecksum, writeMetadata } from "./common";

const EVENT_ID = "evt_kentucky_vibes";
const EVENT_SLUG = "kentucky-vibes";
const DISPLAY_NAME = "Kentucky Vibes Hackathon";
const DEFAULT_SEED = 20260802;
const PROFILE_TARGETS = { small: { teams: 10, users: 25, judges: 6, completed: 25 }, realistic: { teams: 75, users: 150, judges: 30, completed: 250 }, stress: { teams: 100, users: 200, judges: 50, completed: 300 } } as const;
type Profile = keyof typeof PROFILE_TARGETS;

function arg(name: string) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1]?.trim() : undefined; }
function id(kind: string, n: number) { return `kv_${kind}_${String(n).padStart(4, "0")}`; }
function url(host: string, n: number) { return `https://${host}-${String(n).padStart(3, "0")}.example.invalid`; }
const columnCache = new WeakMap<object, Map<string, Set<string>>>();
function tableColumns(db: Database.Database, table: string) { let cache = columnCache.get(db); if (!cache) { cache = new Map(); columnCache.set(db, cache); } const existing = cache.get(table); if (existing) return existing; const columns = new Set((db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>).map((x) => x.name)); cache.set(table, columns); return columns; }
const insertCache = new WeakMap<object, Map<string, ReturnType<Database.Database["prepare"]>>>();
function insert(db: Database.Database, table: string, values: Record<string, unknown>) { const columns = tableColumns(db, table); const entries = Object.entries(values).filter(([key, value]) => columns.has(key) && value !== undefined); const keys = entries.map(([key]) => key).join(","); let cache = insertCache.get(db); if (!cache) { cache = new Map(); insertCache.set(db, cache); } const cacheKey = `${table}:${keys}`; let statement = cache.get(cacheKey); if (!statement) { statement = db.prepare(`INSERT INTO ${table} (${keys}) VALUES (${entries.map(() => "?").join(",")})`); cache.set(cacheKey, statement); } (statement as unknown as { run: (...args: unknown[]) => unknown }).run(...entries.map(([, value]) => value)); }

async function main() {
  const requestedSlug = process.argv[2];
  if (requestedSlug && requestedSlug !== EVENT_SLUG) throw new Error(`Synthetic seed is restricted to the exact event slug ${EVENT_SLUG}.`);
  if (process.env.VIBE_EVENT_SIMULATION !== "1" && process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") throw new Error("Synthetic seed requires VIBE_EVENT_SIMULATION=1 or NODE_ENV=development/test.");
  const profile = (arg("--profile") || "realistic") as Profile; if (!(profile in PROFILE_TARGETS)) throw new Error("Profile must be small, realistic, or stress.");
  const seed = Number(arg("--seed") || DEFAULT_SEED); if (!Number.isInteger(seed)) throw new Error("--seed must be an integer.");
  const source = resolveArtifact(arg("--base") || "current");
  const targetDir = resolve(arg("--output-dir") || SNAPSHOT_DIR); ensureDir(targetDir);
  const stamp = nowUtcStamp(); const target = resolve(arg("--output") || join(targetDir, `kentucky-vibes-base-${profile}-${seed}-${stamp}.sqlite`));
  assertNotCanonical(target); if (existsSync(target)) throw new Error(`Refusing to overwrite existing simulation artifact: ${target}`);
  assertSchemaCompatible(source); const sourceSummary = inspectDatabase(source); verifySummary(sourceSummary); if (!sourceSummary.event) throw new Error("Base artifact has no active source event.");
  await onlineBackup(source, target, { immutable: false }); const db = new Database(target); db.pragma("journal_mode = WAL"); db.pragma("foreign_keys = ON");
  console.error(`[kentucky-vibes] cloned ${target}; hashing credentials`);
  const now = Math.floor(new Date("2026-08-02T12:00:00Z").getTime() / 1000);
  const credentials: Array<{ role: string; userId: string; email: string; password: string }> = [];
  const provenanceRows: Array<{ rootType: string; rootId: string }> = [];
  const passwordHashes = new Map<string, string>();
  const roleHashes = new Map<string, string>();
  const userTarget = PROFILE_TARGETS[profile];
  const ownersTarget = userTarget.teams;
  const teammatesTarget = Math.max(0, userTarget.users - ownersTarget - userTarget.judges);
  for (const role of ["owner", "teammate", "judge"]) roleHashes.set(role, await hashPassword(`KentuckyVibes-${seed}-${role}!`));
  console.error("[kentucky-vibes] credentials ready; seeding rows");
  for (let i = 1; i <= userTarget.users; i += 1) {
    const role = i <= ownersTarget ? "owner" : i <= ownersTarget + teammatesTarget ? "teammate" : "judge";
    passwordHashes.set(id("user", i), roleHashes.get(role)!);
  }
  try {
    db.transaction(() => {
      console.error("[kentucky-vibes] transaction started");
      db.exec(`CREATE TABLE IF NOT EXISTS event_fixture_registry (event_id TEXT NOT NULL, fixture_name TEXT NOT NULL, fixture_version TEXT NOT NULL, seed INTEGER NOT NULL, profile TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(event_id, fixture_name)); CREATE TABLE IF NOT EXISTS event_fixture_records (event_id TEXT NOT NULL, root_type TEXT NOT NULL, root_id TEXT NOT NULL, fixture_name TEXT NOT NULL, seed INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(event_id, root_type, root_id));`);
      db.prepare("UPDATE events SET is_active=0 WHERE is_active=1").run();
      insert(db, "events", { id: EVENT_ID, name: DISPLAY_NAME, slug: EVENT_SLUG, display_name: DISPLAY_NAME, tagline: "Synthetic scale and operations rehearsal", is_active: 1, is_frozen: 0, audience_voting_enabled: 0, audience_award_count: 1, audience_votes_per_person: 1, audience_results_visible: 0, audience_voting_mode: "disabled", audience_identity_method: "anonymous", show_judge_choice: 0, show_peoples_choice: 0, show_ai_choice: 0, show_special_awards: 0, llm_judging_enabled: 0, llm_judging_affects_official_score: 0, start_date: now - 86400 * 3, submission_deadline: now - 86400, judging_deadline: now + 86400, created_at: now, updated_at: now });
      db.prepare("INSERT INTO event_fixture_registry VALUES (?,?,?,?,?,?)").run(EVENT_ID, "kentucky-vibes", "e0.0.1", seed, profile, now); provenanceRows.push({ rootType: "event", rootId: EVENT_ID });
      const target = PROFILE_TARGETS[profile];
      const totalUsers = target.users; const owners = target.teams; const teammates = teammatesTarget; const judgesCount = target.judges; const used = owners + teammates + judgesCount;
      if (used > totalUsers) throw new Error(`Profile ${profile} cannot fit requested users.`);
      for (let i = 1; i <= totalUsers; i += 1) {
        const role = i <= owners ? "owner" : i <= owners + teammates ? "teammate" : "judge";
        const userId = id("user", i); const email = `${role}-${String(i).padStart(4, "0")}@kentucky-vibes.example.invalid`; const password = `KentuckyVibes-${seed}-${role}!`;
        insert(db, "users", { id: userId, name: `Kentucky Vibes ${role} ${String(i).padStart(3, "0")}`, email, email_verified: 1, created_at: now, updated_at: now });
        insert(db, "accounts", { id: id("account", i), account_id: userId, provider_id: "credential", user_id: userId, password: passwordHashes.get(userId), created_at: now, updated_at: now });
        if (tableColumns(db, "user_account_controls").size) insert(db, "user_account_controls", { user_id: userId, status: "active", password_change_required: 0, password_changed_at: now, created_at: now, updated_at: now });
        credentials.push({ role, userId, email, password });
        if (i > owners + teammates) { const judgeNumber = i - owners - teammates; const judgeId = id("judge", judgeNumber); insert(db, "judges", { id: judgeId, token: `synthetic-token-${seed}-${judgeNumber}`, name: `Kentucky Vibes Judge ${String(judgeNumber).padStart(3, "0")}`, email, created_at: now }); insert(db, "judge_authorizations", { id: id("jauth", judgeNumber), user_id: userId, judge_id: judgeId, event_id: EVENT_ID, status: "active", grant_provenance: "kentucky-vibes-seed", invited_at: now, accepted_at: now, created_at: now, updated_at: now }); provenanceRows.push({ rootType: "judge", rootId: judgeId }); }
        provenanceRows.push({ rootType: "user", rootId: userId });
      }
      const scoreIds: string[] = []; const assignmentIds: string[] = []; const submissionIds: string[] = [];
      for (let teamNo = 1; teamNo <= target.teams; teamNo += 1) {
        const teamId = id("team", teamNo); const submissionId = id("submission", teamNo); const ownerId = id("user", teamNo); submissionIds.push(submissionId);
        insert(db, "teams", { id: teamId, event_id: EVENT_ID, name: `Kentucky Vibes Team ${String(teamNo).padStart(3, "0")}`, contact_email: `team-${String(teamNo).padStart(4, "0")}@kentucky-vibes.example.invalid`, affiliation: ["Bluegrass Medical Center", "Cumberland Imaging Institute", "Derby Health Labs", "Riverbend University Hospital", "Appalachian AI Collaborative"][teamNo % 5], description: "Synthetic event fixture team", created_at: now - teamNo * 600, updated_at: now });
        const finalized = teamNo <= Math.ceil(target.teams * 0.86); const state = finalized ? "finalized" : (teamNo % 3 === 0 ? "ready" : "draft");
        insert(db, "submissions", { id: submissionId, team_id: teamId, event_id: EVENT_ID, edit_token: `synthetic-edit-${seed}-${teamNo}`, status: state, team_name: `Kentucky Vibes Team ${String(teamNo).padStart(3, "0")}`, contact_email: `team-${String(teamNo).padStart(4, "0")}@kentucky-vibes.example.invalid`, project_title: ["Bluegrass Workflow Atlas", "Derby Signal Studio", "Cumberland Care Compass", "Riverbend Report Relay", "Appalachian Imaging Loop"][teamNo % 5] + ` ${String(teamNo).padStart(3, "0")}`, problem_statement: "Synthetic radiology workflow problem for scale qualification.", target_users: "Synthetic clinical teams", demo_url: url("demo-kv", teamNo), github_url: url("repo-kv", teamNo), screenshot_url: url("screen-kv", teamNo), readme_url: url("readme-kv", teamNo), agents_md_url: url("agents-kv", teamNo), sample_data_description: "Synthetic data only; no PHI.", setup_instructions: "Synthetic setup", deploy_instructions: "Synthetic deploy", known_limitations: "Qualification fixture", license: "MIT", tags: JSON.stringify(["synthetic", "kentucky-vibes"]), created_at: now - teamNo * 600, submitted_at: finalized ? now - 86400 + teamNo : null, finalized_at: finalized ? now - 43200 + teamNo : null });
        insert(db, "submission_owners", { id: id("owner", teamNo), submission_id: submissionId, user_id: ownerId, created_at: now }); insert(db, "submission_memberships", { id: id("membership", teamNo), submission_id: submissionId, user_id: ownerId, role: "owner", status: "active", joined_at: now - 800, created_at: now - 800, updated_at: now });
        const size = 1 + (teamNo % 6); insert(db, "team_members", { id: id("member", teamNo * 10), team_id: teamId, submission_id: submissionId, name: `Synthetic Lead ${teamNo}`, email: `team-${teamNo}@kentucky-vibes.example.invalid`, badge_number: `KV-SYN-${String(teamNo).padStart(4, "0")}`, badge_verification_status: teamNo % 7 === 0 ? "unchecked" : "verified", affiliation: "Synthetic Institution", degrees: teamNo % 2 ? "MD" : "MS", is_student_trainee: teamNo % 2 });
        for (let member = 2; member <= size && member <= teammates + 1; member += 1) { const teammateNo = ((teamNo + member) % Math.max(1, teammates)) + 1; const teammateUserId = id("user", owners + teammateNo); const memberId = id("member", teamNo * 10 + member); insert(db, "team_members", { id: memberId, team_id: teamId, submission_id: submissionId, name: `Synthetic Teammate ${teamNo}-${member}`, email: `teammate-${teammateNo}@kentucky-vibes.example.invalid`, badge_number: member % 3 ? `KV-SYN-${teamNo}-${member}` : null, badge_verification_status: "unchecked", affiliation: "Synthetic Institution", degrees: "BS", is_student_trainee: member % 2 });
          const invitationId = id("invite", teamNo * 10 + member); insert(db, "submission_membership_invitations", { id: invitationId, submission_id: submissionId, invited_by_user_id: ownerId, intended_member_id: memberId, token_hash: `synthetic-token-hash-${seed}-${teamNo}-${member}`, role: "teammate", status: member % 5 === 0 ? "pending" : member % 7 === 0 ? "revoked" : "accepted", expires_at: now + 86400, accepted_at: member % 5 === 0 ? null : now - 600, revoked_at: member % 7 === 0 ? now - 100 : null, created_at: now - 800, updated_at: now });
          insert(db, "submission_memberships", { id: id("smembership", teamNo * 10 + member), submission_id: submissionId, user_id: teammateUserId, role: "teammate", status: member % 5 === 0 ? "invited" : member % 7 === 0 ? "revoked" : "active", invitation_id: invitationId, invited_at: now - 800, joined_at: member % 5 === 0 ? null : now - 600, revoked_at: member % 7 === 0 ? now - 100 : null, revoked_by_user_id: member % 7 === 0 ? ownerId : null, revocation_reason: member % 7 === 0 ? "Synthetic rotation" : null, created_at: now - 800, updated_at: now });
        }
        // A bounded room/message projection exercises Messages pagination and
        // unread states without enabling chat globally in production.
        if (teamNo % 5 < 3) { const roomId = id("room", teamNo); insert(db, "chat_rooms", { id: roomId, submission_id: submissionId, type: "submission_private", status: "active", created_at: now - 700, updated_at: now - 20 }); for (let messageNo = 1; messageNo <= 5; messageNo += 1) insert(db, "chat_messages", { id: id("message", teamNo * 10 + messageNo), room_id: roomId, author_user_id: messageNo === 3 ? null : ownerId, message_type: messageNo === 3 ? "system_event" : "user_message", body: messageNo === 3 ? "A synthetic teammate joined the room." : `Synthetic planning note ${teamNo}-${messageNo}.`, client_message_id: `kv-${seed}-${teamNo}-${messageNo}`, created_at: now - 700 + messageNo * 30 }); insert(db, "chat_read_states", { id: id("read", teamNo), room_id: roomId, user_id: ownerId, last_read_message_id: id("message", teamNo * 10 + 3), last_read_at: now - 100, updated_at: now - 100 }); provenanceRows.push({ rootType: "chat_room", rootId: roomId }); }
        provenanceRows.push({ rootType: "team", rootId: teamId }, { rootType: "submission", rootId: submissionId }, { rootType: "submission_owner", rootId: id("owner", teamNo) });
        if (finalized) insert(db, "ai_reviews", { id: id("aireview", teamNo), submission_id: submissionId, compliance_check: "pass", demo_validation: "live", screenshot_validation: "valid", generated_score: 60 + (teamNo % 40), scoring_details: JSON.stringify({ reproducibility_score: 60 + (teamNo % 40), fixture: "kentucky-vibes" }), status: "complete", created_at: now - 1000, updated_at: now });
      }
      const finalizedSubs = submissionIds.filter((_, i) => i < Math.ceil(target.teams * 0.86)); const assignmentsTarget = target.completed + Math.max(10, Math.round(target.teams * 0.2)); let assignmentNo = 0; for (const submissionId of finalizedSubs) { const submissionIndex = finalizedSubs.indexOf(submissionId); const extraSlots = assignmentsTarget - finalizedSubs.length * 3; const slots = 3 + (submissionIndex < extraSlots ? 1 : 0) + (submissionIndex < extraSlots - finalizedSubs.length ? 1 : 0); const usedJudges = new Set<number>(); for (let slot = 0; slot < slots && assignmentNo < assignmentsTarget; slot += 1) { let judgeNo = ((assignmentNo * 7 + slot * 3) % judgesCount) + 1; while (usedJudges.has(judgeNo)) judgeNo = (judgeNo % judgesCount) + 1; usedJudges.add(judgeNo); const judgeId = id("judge", judgeNo); const assignmentId = id("assignment", assignmentNo + 1); assignmentNo += 1; assignmentIds.push(assignmentId); insert(db, "judge_assignments", { id: assignmentId, judge_id: judgeId, submission_id: submissionId, created_at: now - 500 + assignmentNo }); insert(db, "judging_assignment_states", { id: id("jastate", assignmentNo), assignment_id: assignmentId, status: "active", conflict_status: assignmentNo % 53 === 0 ? "replacement_required" : "clear", created_at: now - 500, updated_at: now }); const completed = assignmentNo <= target.completed; const status = completed ? (assignmentNo % 11 === 0 ? "frozen" : "submitted") : assignmentNo % 2 ? "draft" : "not_started"; insert(db, "judging_evaluation_states", { id: id("jestate", assignmentNo), assignment_id: assignmentId, status, created_at: now - 500, updated_at: now, frozen_at: status === "frozen" ? now - 20 : null, reopened_at: assignmentNo % 37 === 0 ? now - 100 : null }); if (completed) { const base = 5 + ((submissionIds.indexOf(submissionId) * 3 + judgeNo) % 5); const values = [base, Math.min(10, base + ((judgeNo % 3) - 1)), Math.max(1, base - (judgeNo % 2)), base, Math.min(10, base + 1), base, Math.max(1, base - 1), base]; const scoreId = id("score", assignmentNo); scoreIds.push(scoreId); insert(db, "human_scores", { id: scoreId, submission_id: submissionId, judge_id: judgeId, problem_selection: values[0], product_usefulness: values[1], functionality: values[2], ux_design: values[3], ai_collaboration: values[4], originality: values[5], maintainability: values[6], presentation_clarity: values[7], private_notes: `Synthetic private note KV-${assignmentNo}; never participant-visible.`, recommendation: base >= 8 ? "strong-yes" : base >= 6 ? "yes" : "maybe", completed: 1, created_at: now - 300, updated_at: now - 100 }); provenanceRows.push({ rootType: "assignment", rootId: assignmentId }, { rootType: "score", rootId: scoreId }); } } }
      const allSyntheticMessages = db.prepare("SELECT cm.id FROM chat_messages cm JOIN chat_rooms cr ON cr.id=cm.room_id JOIN submissions s ON s.id=cr.submission_id WHERE s.event_id=?").all(EVENT_ID) as Array<{ id: string }>;
      for (const row of allSyntheticMessages) provenanceRows.push({ rootType: "chat_message", rootId: row.id });
      const allSyntheticReadStates = db.prepare("SELECT rs.id FROM chat_read_states rs JOIN chat_rooms cr ON cr.id=rs.room_id JOIN submissions s ON s.id=cr.submission_id WHERE s.event_id=?").all(EVENT_ID) as Array<{ id: string }>;
      for (const row of allSyntheticReadStates) provenanceRows.push({ rootType: "chat_read_state", rootId: row.id });
      // Record every synthetic assignment, including residual draft/not-started
      // rows that do not have a score yet.
      const allSyntheticAssignments = db.prepare("SELECT ja.id FROM judge_assignments ja JOIN submissions s ON s.id=ja.submission_id WHERE s.event_id=?").all(EVENT_ID) as Array<{ id: string }>;
      for (const row of allSyntheticAssignments) provenanceRows.push({ rootType: "assignment", rootId: row.id });
      console.error(`[kentucky-vibes] generated ${submissionIds.length} submissions and ${assignmentIds.length} assignments`);
      for (const row of provenanceRows) db.prepare("INSERT OR IGNORE INTO event_fixture_records VALUES (?,?,?,?,?,?)").run(EVENT_ID, row.rootType, row.rootId, "kentucky-vibes", seed, now);
      insert(db, "calibration_thresholds", { id: `ct_${EVENT_ID}`, event_id: EVENT_ID, updated_at: now });
      for (const submissionId of finalizedSubs.slice(0, 8)) insert(db, "calibration_consensus_reviews", { id: `ccr_${submissionId}`, event_id: EVENT_ID, submission_id: submissionId, status: "in_review", discussion: "Synthetic consensus review", started_at: now - 100, created_at: now - 100, updated_at: now });
      for (const submissionId of finalizedSubs.slice(0, 5)) insert(db, "result_finalists", { id: `rf_${submissionId}`, event_id: EVENT_ID, submission_id: submissionId, status: "active", reason: "Synthetic fixture finalist", created_at: now, updated_at: now });
    })();
    console.error("[kentucky-vibes] transaction committed");
  } finally { db.close(); }
  const finalized = new Database(target); try { finalized.pragma("wal_checkpoint(TRUNCATE)"); finalized.pragma("journal_mode = DELETE"); } finally { finalized.close(); }
  for (const sidecar of [`${target}-wal`, `${target}-shm`, `${target}-journal`]) if (existsSync(sidecar)) unlinkSync(sidecar);
  setImmutableMode(target); fsyncPath(target); fsyncDir(targetDir); const summary = inspectDatabase(target); verifySummary(summary);
  const credentialsPath = resolve(arg("--credentials") || join("/tmp", `kentucky-vibes-personas-${seed}-${profile}.json`)); writeFileSync(credentialsPath, `${JSON.stringify({ generatedAtUtc: new Date().toISOString(), event: EVENT_SLUG, seed, profile, personas: credentials }, null, 2)}\n`, { mode: 0o600 }); chmodSync(credentialsPath, 0o600);
  const metadata = { createdAtUtc: new Date().toISOString(), sourceArtifact: source, sourceChecksum: sha256(source), artifact: target, checksum: summary.checksum, event: { id: EVENT_ID, slug: EVENT_SLUG, name: DISPLAY_NAME }, seed, profile, profileTargets: PROFILE_TARGETS[profile], counts: summary.counts, credentialsPath, fixtureRegistry: "event_fixture_registry/event_fixture_records", activeEventOverride: `VIBE_JUDGE_EVENT_ID=${EVENT_ID}`, publicationDefault: "calculated/unpublished" };
  writeMetadata(target, metadata); writeChecksum(target);
  const alias = join(targetDir, "kentucky-vibes-base.sqlite"); if (existsSync(alias)) unlinkSync(alias); const { symlinkSync } = await import("node:fs"); symlinkSync(target, alias); console.log(JSON.stringify({ artifact: target, alias, metadata: `${target}.json`, checksum: `${target}.sha256`, credentialsPath, summary }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
