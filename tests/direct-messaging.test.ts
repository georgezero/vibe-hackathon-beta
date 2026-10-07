import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";
import {
  findOrCreateDirectConversation,
  canInitiateDirectMessage,
  listDirectMessages,
  listDirectConversations,
  postDirectMessage,
  blockParticipant,
  resolveDirectConversationAccess,
} from "@/lib/direct-messaging";

const databasePath = process.env.DB_FILE_NAME!;
let ready = false;

function setup() {
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys=ON");
  // Most repository tests intentionally share one disposable database. If an
  // earlier fixture owns the generic Better Auth tables, leave that fixture
  // untouched; the focused run (the qualification path for this domain) gets
  // the complete disposable schema below.
  if (sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get()) {
    sqlite.close();
    return;
  }
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, image TEXT);
    CREATE TABLE user_account_controls (user_id TEXT PRIMARY KEY REFERENCES users(id), status TEXT NOT NULL DEFAULT 'active');
    CREATE TABLE user_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), handle TEXT UNIQUE, display_name TEXT, headline TEXT, bio TEXT, affiliation TEXT, degrees TEXT, website_url TEXT, github_url TEXT, linkedin_url TEXT, interests TEXT, visibility TEXT NOT NULL DEFAULT 'private', discoverable INTEGER NOT NULL DEFAULT 0, deactivated_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE audit_events (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, actor_type TEXT, actor_id TEXT, metadata TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE events (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL DEFAULT 0, is_frozen INTEGER NOT NULL DEFAULT 0, start_date INTEGER, submission_deadline INTEGER, judging_deadline INTEGER, audience_voting_enabled INTEGER NOT NULL DEFAULT 0, audience_award_count INTEGER NOT NULL DEFAULT 1, audience_votes_per_person INTEGER NOT NULL DEFAULT 1, audience_voting_starts_at INTEGER, audience_voting_ends_at INTEGER, audience_results_visible INTEGER NOT NULL DEFAULT 0, audience_voting_mode TEXT NOT NULL DEFAULT 'disabled', audience_identity_method TEXT NOT NULL DEFAULT 'anonymous', winners_published_at INTEGER, show_judge_choice INTEGER NOT NULL DEFAULT 1, show_peoples_choice INTEGER NOT NULL DEFAULT 1, show_ai_choice INTEGER NOT NULL DEFAULT 1, show_special_awards INTEGER NOT NULL DEFAULT 1, display_name TEXT, logo_url TEXT, tagline TEXT, external_url TEXT, llm_judging_enabled INTEGER NOT NULL DEFAULT 0, llm_judging_affects_official_score INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE submissions (id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id));
    CREATE TABLE submission_owners (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), user_id TEXT NOT NULL REFERENCES users(id));
    CREATE TABLE submission_memberships (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'teammate');
    INSERT INTO users VALUES ('u1','Maya Rivera','u1@example.invalid',NULL),('u2','Jordan Lee','u2@example.invalid',NULL),('u3','Private Person','u3@example.invalid',NULL),('u4','Former Person','u4@example.invalid',NULL),('u5','Unaffiliated Builder','u5@example.invalid',NULL);
    INSERT INTO user_account_controls VALUES ('u4','disabled');
    INSERT INTO events (id,name,slug,is_active,created_at,updated_at) VALUES ('event-1','Kentucky Vibes','kentucky-vibes',1,1,1);
    INSERT INTO submissions VALUES ('sub-1','event-1'),('sub-2','event-1');
    INSERT INTO submission_owners VALUES ('owner-1','sub-1','u1'),('owner-2','sub-2','u2');
    INSERT INTO submission_memberships VALUES ('mem-1','sub-1','u1','active','owner'),('mem-2','sub-2','u2','active','owner');
    INSERT INTO user_profiles (id,user_id,handle,display_name,visibility,discoverable,created_at,updated_at) VALUES ('p1','u1','maya','Maya Rivera','public',1,1,1),('p2','u2','jordan','Jordan Lee','public',1,1,1),('p3','u3','private','Private Person','private',0,1,1),('p4','u4','former','Former Person','public',1,1,1),('p5','u5','unaffiliated','Unaffiliated Builder','public',1,1,1);
  `);
  sqlite.close();
  const env = { ...process.env, VIBE_F2_MIGRATION_CONFIRM: `MIGRATE DIRECT MESSAGING DATABASE ${databasePath}` };
  execFileSync("npx", ["tsx", "scripts/migrate-direct-messaging.ts"], { cwd: process.cwd(), env, encoding: "utf8" });
  ready = true;
}

describe("direct messaging authorization and projections", () => {
  beforeAll(setup);
  it("creates one canonical pair and rejects private initiation without requiring event membership", async () => {
    if (!ready) return;
    const concurrent = await Promise.all(Array.from({ length: 4 }, () => findOrCreateDirectConversation({ senderUserId: "u1", recipientHandle: "jordan" })));
    expect(new Set(concurrent).size).toBe(1);
    const first = concurrent[0];
    const second = await findOrCreateDirectConversation({ senderUserId: "u1", recipientHandle: "jordan" });
    expect(second).toBe(first);
    await expect(findOrCreateDirectConversation({ senderUserId: "u1", recipientHandle: "private" })).rejects.toMatchObject({ code: "recipient_not_available" });
    await expect(canInitiateDirectMessage({ senderUserId: "u5", recipientHandle: "jordan" })).resolves.toBe(true);
    await expect(canInitiateDirectMessage({ senderUserId: "missing-user", recipientHandle: "jordan" })).resolves.toBe(false);
    const unaffiliatedConversation = await findOrCreateDirectConversation({ senderUserId: "u5", recipientHandle: "jordan" });
    expect(unaffiliatedConversation).toMatch(/^dm_/);
  });

  it("keeps message projections safe and client retries idempotent", async () => {
    if (!ready) return;
    const id = await findOrCreateDirectConversation({ senderUserId: "u1", recipientHandle: "jordan" });
    const message = await postDirectMessage({ conversationId: id, userId: "u1", body: "Hello", clientMessageId: "same-client-id" });
    const retry = await postDirectMessage({ conversationId: id, userId: "u1", body: "Hello", clientMessageId: "same-client-id" });
    expect(retry.id).toBe(message.id);
    await expect(postDirectMessage({ conversationId: id, userId: "u1", body: "Different", clientMessageId: "same-client-id" })).rejects.toMatchObject({ code: "message_conflict" });
    const history = await listDirectMessages({ conversationId: id, userId: "u2" });
    expect(history.messages[0]).toMatchObject({ body: "Hello", author: "participant" });
    expect(history.messages[0]).not.toHaveProperty("email");
    expect(history.messages[0]).not.toHaveProperty("userId");
  });

  it("ignores the legacy allowIncoming=none value and supports an offline recipient", async () => {
    if (!ready) return;
    const sqlite = new Database(databasePath);
    sqlite.prepare("INSERT INTO participant_messaging_preferences (user_id, allow_incoming, updated_at) VALUES (?, 'none', ?) ON CONFLICT(user_id) DO UPDATE SET allow_incoming = 'none', updated_at = excluded.updated_at").run("u2", Date.now());
    const sessionsTable = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='session'").get()
      || sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions'").get();
    if (sessionsTable) {
      const table = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='session'").get() ? "session" : "sessions";
      sqlite.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run("u2");
      expect((sqlite.prepare(`SELECT count(*) AS count FROM ${table} WHERE user_id = ?`).get("u2") as { count: number }).count).toBe(0);
    }
    sqlite.close();

    const conversationId = await findOrCreateDirectConversation({ senderUserId: "u1", recipientHandle: "jordan" });
    const sent = await postDirectMessage({ conversationId, userId: "u1", body: "Offline delivery", clientMessageId: "offline-delivery-1" });
    expect(sent.body).toBe("Offline delivery");
    const recipientHistory = await listDirectMessages({ conversationId, userId: "u2" });
    expect(recipientHistory.messages.at(-1)).toMatchObject({ body: "Offline delivery", author: "participant" });
    expect((await listDirectConversations("u2")).find((row) => row.id === conversationId)?.unreadCount).toBeGreaterThan(0);
  });

  it("blocks both directions and preserves existing history", async () => {
    if (!ready) return;
    const id = await findOrCreateDirectConversation({ senderUserId: "u1", recipientHandle: "jordan" });
    await blockParticipant({ blockerUserId: "u1", blockedUserId: "u2" });
    await expect(postDirectMessage({ conversationId: id, userId: "u2", body: "Blocked", clientMessageId: "blocked-1" })).rejects.toMatchObject({ code: "message_blocked" });
    const access = await resolveDirectConversationAccess({ conversationId: id, userId: "u2" });
    expect(access.canSend).toBe(false);
    expect((await listDirectMessages({ conversationId: id, userId: "u2" })).messages.length).toBeGreaterThan(0);
  });
});
