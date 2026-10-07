import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ensureOwnProfile,
  deactivateOwnProfile,
  getOwnProfile,
  getPublicProfileByHandle,
  getPublicProfilePageByHandle,
  listPublicProfileAwards,
  listPublicProfileLinksForSubmission,
  listParticipantIdentitiesForUsers,
  listPublicProfileProjects,
  normalizeProfileFields,
  normalizeProfileHandle,
  normalizeProfileInterests,
  ProfileDomainError,
  updateOwnProfile,
  getProfileCompleteness,
} from "@/lib/user-profiles";
import { listPeopleDirectory } from "@/lib/people-directory";

const databasePath = process.env.DB_FILE_NAME!;

function setupDatabase() {
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT, email TEXT NOT NULL UNIQUE, image TEXT
    );
    CREATE TABLE user_account_controls (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, actor_type TEXT, actor_id TEXT, metadata TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE events (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE);
    CREATE TABLE submissions (
      id TEXT PRIMARY KEY, event_id TEXT REFERENCES events(id), status TEXT NOT NULL,
      team_name TEXT NOT NULL, project_title TEXT
    );
    CREATE TABLE submission_owners (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), user_id TEXT NOT NULL REFERENCES users(id)
    );
    CREATE TABLE submission_memberships (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL
    );
    CREATE TABLE publication_releases (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), status TEXT NOT NULL
    );
    CREATE TABLE publication_awards (
      id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), submission_id TEXT NOT NULL REFERENCES submissions(id), label TEXT NOT NULL, status TEXT NOT NULL
    );
    INSERT INTO users (id,name,email) VALUES
      ('owner','Owner Person','owner@example.invalid'),
      ('teammate','Teammate Person','teammate@example.invalid'),
      ('revoked','Revoked Person','revoked@example.invalid'),
      ('roster-only','Roster Only','same@example.invalid'),
      ('judge-participant','Judge Participant','judge-participant@example.invalid'),
      ('profile-member','Profile Member','profile-member@example.invalid'),
      ('disabled','Disabled Person','disabled@example.invalid'),
      ('empty-name',NULL,'empty@example.invalid');
    INSERT INTO user_account_controls (user_id,status) VALUES ('disabled','disabled');
    INSERT INTO events (id,name,slug) VALUES ('event-public','Public Event','public-event'),('event-private','Private Event','private-event');
    INSERT INTO publication_releases (id,event_id,status) VALUES ('release-public','event-public','published'),('release-private','event-private','calculated');
    INSERT INTO submissions (id,event_id,status,team_name,project_title) VALUES
      ('project-owner','event-public','finalized','Owner Team','Published Project'),
      ('project-unpublished','event-private','finalized','Private Team','Private Project'),
      ('project-revoked','event-public','finalized','Revoked Team','Revoked Project');
    INSERT INTO submission_owners (id,submission_id,user_id) VALUES ('owner-link','project-owner','owner');
    INSERT INTO submission_owners (id,submission_id,user_id) VALUES ('owner-private-link','project-unpublished','owner');
    INSERT INTO submission_memberships (id,submission_id,user_id,status) VALUES
      ('teammate-link','project-owner','teammate','active'),
      ('profile-member-link','project-owner','profile-member','active'),
      ('revoked-link','project-revoked','revoked','revoked');
    INSERT INTO publication_awards (id,event_id,submission_id,label,status) VALUES
      ('award-public','event-public','project-owner','Grand Prize','active'),
      ('award-private','event-private','project-unpublished','Secret Prize','active');
  `);
  sqlite.close();
  const env = { ...process.env, VIBE_USER_PROFILES_MIGRATION_CONFIRM: `MIGRATE USER PROFILES DATABASE ${databasePath}` };
  execFileSync("npx", ["tsx", "scripts/migrate-user-profiles.ts"], { cwd: process.cwd(), env, encoding: "utf8" });
}

describe("durable participant profile domain", () => {
  beforeAll(setupDatabase);

  it("normalizes strict ASCII handles and rejects unsafe/reserved values", () => {
    expect(normalizeProfileHandle("  George-Shih ")).toBe("george-shih");
    expect(normalizeProfileHandle("RADIology-AI")).toBe("radiology-ai");
    for (const value of ["@george", "george@", "george_shih", "george--shih", "-george", "george-", "ge", "george@example.com", "éclair", "admin"]) {
      expect(() => normalizeProfileHandle(value)).toThrow(ProfileDomainError);
    }
  });

  it("normalizes bounded interests deterministically", () => {
    expect(normalizeProfileInterests([" imaging ", "AI", "ai", "", "Safety"])).toEqual(["imaging", "AI", "Safety"]);
    expect(() => normalizeProfileInterests(Array.from({ length: 13 }, (_, index) => `x${index}`))).toThrow(ProfileDomainError);
  });

  it("validates links without fetching or accepting lookalike hosts", () => {
    expect(normalizeProfileFields({
      websiteUrl: "http://example.invalid/about",
      githubUrl: "https://github.com/example/profile#bio",
      linkedinUrl: "https://www.linkedin.com/in/example",
    })).toMatchObject({
      websiteUrl: "http://example.invalid/about",
      githubUrl: "https://github.com/example/profile",
      linkedinUrl: "https://www.linkedin.com/in/example",
    });
    for (const input of [
      { websiteUrl: "javascript:alert(1)" },
      { websiteUrl: "https://user:pass@example.invalid" },
      { githubUrl: "https://github.example.invalid/person" },
      { githubUrl: "https://github.com" },
      { linkedinUrl: "https://not-linkedin.com/person" },
    ]) expect(() => normalizeProfileFields(input)).toThrow(ProfileDomainError);
  });

  it("lazily creates private shells and never invents a display name", async () => {
    const named = await ensureOwnProfile("owner");
    expect(named.displayName).toBe("Owner Person");
    expect(named.visibility).toBe("private");
    const empty = await ensureOwnProfile("empty-name");
    expect(empty.displayName).toBeNull();
    expect(await getOwnProfile("owner")).toMatchObject({ userId: "owner", visibility: "private" });
    expect((await getOwnProfile("owner"))?.discoverable).toBe(false);
    await ensureOwnProfile("owner");
    expect((await getOwnProfile("owner"))?.displayName).toBe("Owner Person");
    await expect(ensureOwnProfile("missing")).rejects.toMatchObject({ code: "user_not_found" });
  });

  it("enforces reserved/unique handles and only permits complete public profiles", async () => {
    await expect(updateOwnProfile("owner", { handle: "admin" })).rejects.toMatchObject({ code: "reserved_handle" });
    await updateOwnProfile("owner", { handle: "owner-person", displayName: "Owner Person", headline: "Builder", visibility: "public" });
    await expect(updateOwnProfile("teammate", { handle: "owner-person", displayName: "Another Person", visibility: "public" })).rejects.toMatchObject({ code: "handle_taken" });
    await expect(updateOwnProfile("empty-name", { visibility: "public" })).rejects.toMatchObject({ code: "invalid_profile_field" });
    const concurrent = await Promise.allSettled([
      updateOwnProfile("judge-participant", { handle: "race-handle", displayName: "Judge Participant", visibility: "public" }),
      updateOwnProfile("revoked", { handle: "race-handle", displayName: "Revoked Person", visibility: "public" }),
    ]);
    expect(concurrent.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === "rejected").map((result) => (result as PromiseRejectedResult).reason.code)).toEqual(["handle_taken"]);
  });

  it("uses generic not-found semantics for private, deactivated, and disabled profiles", async () => {
    expect(await getPublicProfileByHandle("owner-person")).toMatchObject({ handle: "owner-person", displayName: "Owner Person", avatar: { kind: "initials", initials: "OP" } });
    const publicShape = await getPublicProfileByHandle("owner-person");
    expect(publicShape).not.toHaveProperty("userId");
    expect(publicShape).not.toHaveProperty("email");
    await updateOwnProfile("owner", { visibility: "private" });
    expect(await getPublicProfileByHandle("owner-person")).toBeNull();
    await updateOwnProfile("owner", { visibility: "public" });
    await deactivateOwnProfile("owner");
    expect(await getPublicProfileByHandle("owner-person")).toBeNull();
    await updateOwnProfile("disabled", { handle: "disabled-person", displayName: "Disabled Person", visibility: "public" });
    expect(await getPublicProfileByHandle("disabled-person")).toBeNull();
  });

  it("derives history and awards only from explicit membership and published D.4 state", async () => {
    const ownerProjects = await listPublicProfileProjects("owner");
    expect(ownerProjects).toHaveLength(1);
    expect(ownerProjects[0]).toMatchObject({ projectId: "project-owner", eventSlug: "public-event", publicationState: "published" });
    expect(await listPublicProfileProjects("teammate")).toHaveLength(1);
    expect(await listPublicProfileProjects("revoked")).toHaveLength(0);
    expect(await listPublicProfileProjects("roster-only")).toHaveLength(0);
    expect(await listPublicProfileProjects("judge-participant")).toHaveLength(0);
    expect(await listPublicProfileAwards("owner")).toMatchObject([{ awardId: "award-public", awardName: "Grand Prize", eventSlug: "public-event" }]);
    expect(await listPublicProfileAwards("teammate")).toHaveLength(1);
    expect(await listPublicProfileAwards("revoked")).toHaveLength(0);
  });

  it("builds a safe public page and explicit team profile links", async () => {
    await updateOwnProfile("profile-member", { handle: "profile-member", displayName: "Profile Member", visibility: "public" });
    const page = await getPublicProfilePageByHandle("profile-member");
    expect(page).toMatchObject({ handle: "profile-member", displayName: "Profile Member", projects: [{ projectId: "project-owner" }] });
    expect(page).not.toHaveProperty("userId");
    expect(page).not.toHaveProperty("email");
    expect(page?.projects[0]).not.toHaveProperty("publicationState");
    expect(await listPublicProfileLinksForSubmission("project-owner")).toEqual([
      { handle: "profile-member", displayName: "Profile Member", headline: null, affiliation: null },
    ]);
  });

  it("resolves account-backed participant identity without leaking private profile fields", async () => {
    await updateOwnProfile("teammate", {
      handle: "teammate-public",
      displayName: "Teammate Public",
      headline: "Public headline",
      affiliation: "Synthetic Lab",
      visibility: "public",
    });
    const identities = await listParticipantIdentitiesForUsers(["teammate", "owner", "roster-only"]);
    expect(identities.get("teammate")).toMatchObject({ handle: "teammate-public", headline: "Public headline", affiliation: "Synthetic Lab" });
    expect(identities.get("owner")).toMatchObject({ displayName: "Owner Person", handle: null, headline: null, affiliation: null });
    expect(identities.get("roster-only")).toMatchObject({ displayName: "Roster Only", handle: null });
    expect(identities.get("teammate")).not.toHaveProperty("userId");
    expect(identities.get("teammate")).not.toHaveProperty("email");
  });

  it("keeps directory listing explicit, event-scoped, and separate from public links", async () => {
    await updateOwnProfile("profile-member", {
      handle: "profile-member-directory",
      displayName: "Profile Member",
      visibility: "public",
      discoverable: true,
      interests: ["AI", "Workflow"],
    });
    await updateOwnProfile("teammate", { visibility: "public", discoverable: false });
    await updateOwnProfile("roster-only", { handle: "roster-only", displayName: "Roster Only", visibility: "public", discoverable: true });
    const directory = await listPeopleDirectory("event-public", { search: "profile member" });
    expect(directory.total).toBe(1);
    expect(directory.cards[0]).toMatchObject({ handle: "profile-member-directory", displayName: "Profile Member", interests: ["AI", "Workflow"] });
    expect(directory.cards[0]).not.toHaveProperty("userId");
    expect(directory.cards[0]).not.toHaveProperty("email");
    expect((await listPeopleDirectory("event-public", { search: "teammate" })).total).toBe(0);
    expect((await listPeopleDirectory("event-public", { search: "judge participant" })).total).toBe(0);
    expect((await listPeopleDirectory("event-public", { search: "roster only" })).total).toBe(1);
    await updateOwnProfile("profile-member", { visibility: "private" });
    expect((await getOwnProfile("profile-member"))?.discoverable).toBe(false);
    expect((await listPeopleDirectory("event-public", { search: "profile member" })).total).toBe(0);
  });

  it("keeps profile data independent from roles and account identity links", async () => {
    await updateOwnProfile("judge-participant", { handle: "judge-participant", displayName: "Judge Participant", visibility: "public" });
    const profile = await getPublicProfileByHandle("judge-participant");
    expect(profile).toMatchObject({ handle: "judge-participant" });
    expect(profile).not.toHaveProperty("judgeId");
    expect(profile).not.toHaveProperty("vibySubject");
  });

  it("provides a small completion signal and structural audit without profile contents", async () => {
    const profile = await updateOwnProfile("empty-name", {
      displayName: "Empty Name Person",
      headline: "Building safer workflows",
      bio: "A private bio that must not be copied into an audit record.",
      websiteUrl: "https://example.invalid/profile",
      interests: ["AI"],
    });
    expect(getProfileCompleteness(profile).label).toBe("4 of 6 recommended details added");
    const sqlite = new Database(databasePath);
    const audits = sqlite.prepare("SELECT action, metadata FROM audit_events WHERE entity_id = ? ORDER BY created_at").all("empty-name") as Array<{ action: string; metadata: string }>;
    sqlite.close();
    expect(audits.some((audit) => audit.action === "profile_updated")).toBe(true);
    expect(audits.map((audit) => audit.metadata).join(" ")).not.toContain("private bio");
  });
});
