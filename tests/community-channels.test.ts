import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";
import { canAccessCommunity, createCommunityChannel, listCommunityMessages, postCommunityMessage, reportCommunityMessage, resolveCommunityChannelAccess, setCommunityMessageRemoved, type CommunityMessageProjection, updateCommunityChannel } from "@/lib/community-channels";

const databasePath = process.env.DB_FILE_NAME!;
let ready = false;

function setup() {
  const sqlite = new Database(databasePath);
  if (sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get()) { sqlite.close(); return; }
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, email_verified INTEGER NOT NULL DEFAULT 1, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE user_account_controls (user_id TEXT PRIMARY KEY REFERENCES users(id), status TEXT NOT NULL DEFAULT 'active', password_change_required INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE user_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), handle TEXT UNIQUE, display_name TEXT, headline TEXT, bio TEXT, affiliation TEXT, degrees TEXT, website_url TEXT, github_url TEXT, linkedin_url TEXT, interests TEXT, visibility TEXT NOT NULL DEFAULT 'private', discoverable INTEGER NOT NULL DEFAULT 0, deactivated_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE audit_events (id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL, actor_type TEXT, actor_id TEXT, metadata TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE admin_authorizations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'active', grant_source TEXT NOT NULL DEFAULT 'operator', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, revoked_at INTEGER);
    CREATE TABLE events (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, is_active INTEGER NOT NULL DEFAULT 0, is_frozen INTEGER NOT NULL DEFAULT 0, start_date INTEGER, submission_deadline INTEGER, judging_deadline INTEGER, audience_voting_enabled INTEGER NOT NULL DEFAULT 0, audience_award_count INTEGER NOT NULL DEFAULT 1, audience_votes_per_person INTEGER NOT NULL DEFAULT 1, audience_voting_starts_at INTEGER, audience_voting_ends_at INTEGER, audience_results_visible INTEGER NOT NULL DEFAULT 0, audience_voting_mode TEXT NOT NULL DEFAULT 'disabled', audience_identity_method TEXT NOT NULL DEFAULT 'anonymous', winners_published_at INTEGER, show_judge_choice INTEGER NOT NULL DEFAULT 1, show_peoples_choice INTEGER NOT NULL DEFAULT 1, show_ai_choice INTEGER NOT NULL DEFAULT 1, show_special_awards INTEGER NOT NULL DEFAULT 1, display_name TEXT, logo_url TEXT, tagline TEXT, external_url TEXT, llm_judging_enabled INTEGER NOT NULL DEFAULT 0, llm_judging_affects_official_score INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE submissions (id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id));
    CREATE TABLE submission_owners (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), user_id TEXT NOT NULL REFERENCES users(id));
    CREATE TABLE submission_memberships (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    INSERT INTO users VALUES ('u1','Maya Rivera','maya@example.invalid',1,NULL,1,1),('u2','Jordan Lee','jordan@example.invalid',1,NULL,1,1),('u3','Unrelated','unrelated@example.invalid',1,NULL,1,1),('admin','Organizer','organizer@example.invalid',1,NULL,1,1);
    INSERT INTO user_account_controls (user_id,status,created_at,updated_at) VALUES ('u1','active',1,1),('u2','active',1,1),('u3','active',1,1),('admin','active',1,1);
    INSERT INTO admin_authorizations VALUES ('admin-auth','admin','active','operator',1,1,NULL);
    INSERT INTO events (id,name,slug,is_active,created_at,updated_at) VALUES ('event-1','Kentucky Vibes','kentucky-vibes',1,1,1);
    INSERT INTO submissions VALUES ('sub-1','event-1'),('sub-2','event-1');
    INSERT INTO submission_owners VALUES ('owner-1','sub-1','u1');
    INSERT INTO submission_memberships VALUES ('mem-1','sub-1','u1','owner','active',1,1),('mem-2','sub-2','u2','owner','active',1,1);
    INSERT INTO user_profiles (id,user_id,handle,display_name,visibility,discoverable,created_at,updated_at) VALUES ('p1','u1','maya','Maya Rivera','public',1,1,1),('p2','u2','jordan','Jordan Lee','public',1,1,1),('p3','u3','private','Private Person','private',0,1,1);
  `);
  sqlite.close();
  const env = { ...process.env, VIBE_F3_MIGRATION_CONFIRM: `MIGRATE COMMUNITY CHANNELS DATABASE ${databasePath}` };
  execFileSync("npx", ["tsx", "scripts/migrate-community-channels.ts"], { cwd: process.cwd(), env, encoding: "utf8" });
  ready = true;
}

describe("community channel boundaries", () => {
  beforeAll(setup);
  it("allows active accounts without projects while keeping channels event-scoped", async () => {
    if (!ready) return;
    await expect(canAccessCommunity("u1", "event-1")).resolves.toBe(true);
    await expect(canAccessCommunity("u3", "event-1")).resolves.toBe(true);
    await expect(canAccessCommunity("admin", "event-1")).resolves.toBe(true);
    await expect(canAccessCommunity("u4", "event-1")).resolves.toBe(false);
    await expect(canAccessCommunity("missing-user", "event-1")).resolves.toBe(false);
    await expect(resolveCommunityChannelAccess({ slug: "general", userId: "u1" })).rejects.toMatchObject({ code: "channel_not_found" });
    await createCommunityChannel({ adminUserId: "admin", eventId: "event-1", slug: "general", name: "General", description: "Event discussion" });
    await expect(resolveCommunityChannelAccess({ slug: "general", userId: "u1", eventId: "event-1" })).resolves.toMatchObject({ channel: { slug: "general" } });
    await expect(resolveCommunityChannelAccess({ slug: "general", userId: "u3", eventId: "event-1" })).resolves.toMatchObject({ channel: { slug: "general" } });
    await expect(listCommunityMessages({ slug: "general", userId: "u3", eventId: "event-1" })).resolves.toMatchObject({ access: { channel: { slug: "general" } } });
    await expect(createCommunityChannel({ adminUserId: "admin", eventId: "event-1", slug: "admin", name: "Admin", description: "Reserved route" })).rejects.toMatchObject({ code: "reserved_channel_slug" });
  });

  it("separates announcements posting and makes retries idempotent", async () => {
    if (!ready) return;
    await createCommunityChannel({ adminUserId: "admin", eventId: "event-1", slug: "announcements", name: "Announcements", description: "Organizer updates", type: "announcements", postingPolicy: "admins_only" });
    await expect(postCommunityMessage({ slug: "announcements", userId: "u1", eventId: "event-1", body: "Not allowed", clientMessageId: "nope" })).rejects.toMatchObject({ code: "posting_not_allowed" });
    await expect(postCommunityMessage({ slug: "general", userId: "u3", eventId: "event-1", body: "Unaffiliated accounts can join the discussion", clientMessageId: "unaffiliated" })).resolves.toMatchObject({ id: expect.stringMatching(/^cmsg_/) });
    const first = await postCommunityMessage({ slug: "general", userId: "u1", eventId: "event-1", body: "Hello community", clientMessageId: "same" });
    const retry = await postCommunityMessage({ slug: "general", userId: "u1", eventId: "event-1", body: "Hello community", clientMessageId: "same" });
    expect(retry.id).toBe(first.id);
  });

  it("keeps projections safe and supports report/tombstone moderation", async () => {
    if (!ready) return;
    const history = await listCommunityMessages({ slug: "general", userId: "u1", eventId: "event-1" });
    expect(history.messages[0]).not.toHaveProperty("email");
    expect(history.messages[0]).not.toHaveProperty("userId");
    const report = await reportCommunityMessage({ slug: "general", reporterUserId: "u1", messageId: history.messages[0].id, eventId: "event-1", category: "other" });
    expect(report.id).toMatch(/^creport_/);
    await setCommunityMessageRemoved({ messageId: history.messages[0].id, adminUserId: "admin", eventId: "event-1", removed: true });
    const after = await listCommunityMessages({ slug: "general", userId: "u1", eventId: "event-1" });
    expect(after.messages.find((message: CommunityMessageProjection) => message.id === history.messages[0].id)).toMatchObject({ body: "Message removed by an organizer.", isRemoved: true });
  });

  it("keeps archived channels readable but not writable and prevents cross-event access", async () => {
    if (!ready) return;
    await createCommunityChannel({ adminUserId: "admin", eventId: "event-1", slug: "archive-check", name: "Archive check", description: "Read-only qualification channel" });
    const event2 = new Database(databasePath);
    event2.prepare("INSERT INTO events (id,name,slug,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?)").run("event-2", "Other Event", "other-event", 0, 1, 1);
    event2.close();
    await createCommunityChannel({ adminUserId: "admin", eventId: "event-2", slug: "general", name: "General", description: "Other event" });
    await expect(resolveCommunityChannelAccess({ slug: "general", userId: "u1", eventId: "event-2" })).resolves.toMatchObject({ channel: { slug: "general" } });
    const archiveDb = new Database(databasePath);
    const archive = archiveDb.prepare("SELECT id FROM community_channels WHERE slug = 'archive-check' AND event_id = 'event-1'").get() as { id: string };
    archiveDb.close();
    await updateCommunityChannel({ channelId: archive.id, adminUserId: "admin", eventId: "event-1", status: "archived" });
    await expect(postCommunityMessage({ slug: "archive-check", userId: "u1", eventId: "event-1", body: "Too late", clientMessageId: "archived" })).rejects.toMatchObject({ code: "channel_archived" });
    await expect(listCommunityMessages({ slug: "archive-check", userId: "u1", eventId: "event-1" })).resolves.toMatchObject({ access: { channel: { status: "archived" } } });
  });
});
