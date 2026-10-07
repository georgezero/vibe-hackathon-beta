import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  events,
  publicationAwards,
  publicationReleases,
  submissions,
  submissionMemberships,
  submissionOwners,
  auditEvents,
  userAccountControls,
  userProfiles,
  users,
} from "@/lib/db/schema";
import { calculateProfileCompleteness, type ProfileCompleteness } from "@/lib/profile-completeness";

export { calculateProfileCompleteness } from "@/lib/profile-completeness";
export type { ProfileCompleteness } from "@/lib/profile-completeness";

export const PROFILE_VISIBILITIES = ["private", "public"] as const;
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];

/**
 * Route words are reserved in one place so a future profile route cannot
 * collide with an existing application surface. This list intentionally
 * includes routes that do not yet exist, but are already part of the product
 * vocabulary and should not become someone else's public identity URL.
 */
export const RESERVED_PROFILE_HANDLES = new Set([
  "admin", "account", "login", "logout", "people", "projects", "project",
  "judge", "judging", "settings", "api", "health", "status", "winners",
  "start", "submit", "recover", "presentation", "results", "calibration",
  "publication", "favicon", "register-team", "submission", "mcp", "audience",
  "ai-evals", "voting", "terms", "privacy",
]);

export type ProfileDomainErrorCode =
  | "user_not_found"
  | "profile_not_found"
  | "invalid_handle"
  | "reserved_handle"
  | "handle_taken"
  | "invalid_display_name"
  | "invalid_profile_field"
  | "invalid_url"
  | "invalid_visibility"
  | "profile_not_public"
  | "profile_deactivated"
  | "account_disabled";

export class ProfileDomainError extends Error {
  constructor(public readonly code: ProfileDomainErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ProfileDomainError";
  }
}

export type PublicParticipantProfile = {
  handle: string;
  displayName: string;
  avatar: { kind: "initials"; initials: string };
  headline: string | null;
  bio: string | null;
  affiliation: string | null;
  degrees: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  interests: string[];
};

/**
 * Complete public page model. The account identifier used to derive project
 * history never crosses this domain boundary; public routes receive only this
 * safe projection.
 */
export type PublicParticipantProfilePage = PublicParticipantProfile & {
  projects: Array<Omit<ProfileProjectHistoryItem, "publicationState">>;
  awards: Array<Omit<ProfileAwardItem, "publicationState">>;
};

export type PublicParticipantProfileLink = {
  handle: string;
  displayName: string;
  headline: string | null;
  affiliation: string | null;
};

/**
 * Safe identity data for participant-facing surfaces. The account identifier
 * is used only as an internal map key and never crosses into this value or a
 * component prop. Private profile fields are intentionally omitted.
 */
export type ParticipantIdentityData = {
  displayName: string;
  initials: string;
  handle: string | null;
  headline: string | null;
  affiliation: string | null;
};

export type ProfileProjectHistoryItem = {
  projectId: string;
  projectTitle: string;
  teamName: string;
  eventSlug: string;
  eventName: string;
  publicationState: "published" | "archived";
};

export type ProfileAwardItem = {
  awardId: string;
  awardName: string;
  projectId: string;
  projectTitle: string;
  eventSlug: string;
  eventName: string;
  publicationState: "published" | "archived";
};

export type ProfileEditorData = {
  handle: string | null;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  affiliation: string | null;
  degrees: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  interests: string[];
  visibility: ProfileVisibility;
  discoverable: boolean;
  deactivatedAt: string | null;
};

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HANDLE_MAX_LENGTH = 30;
const HANDLE_MIN_LENGTH = 3;

function textValue(value: unknown, field: string, max: number, min = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ProfileDomainError("invalid_profile_field", field);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new ProfileDomainError(field === "displayName" ? "invalid_display_name" : "invalid_profile_field", field);
  }
  return normalized || null;
}

export function normalizeProfileHandle(input: unknown): string {
  if (typeof input !== "string") throw new ProfileDomainError("invalid_handle");
  let normalized: string;
  try {
    normalized = input.normalize("NFKC").trim().toLowerCase();
  } catch {
    throw new ProfileDomainError("invalid_handle");
  }
  if (
    normalized.length < HANDLE_MIN_LENGTH
    || normalized.length > HANDLE_MAX_LENGTH
    || !HANDLE_PATTERN.test(normalized)
  ) throw new ProfileDomainError("invalid_handle");
  if (RESERVED_PROFILE_HANDLES.has(normalized)) throw new ProfileDomainError("reserved_handle");
  return normalized;
}

function normalizeOptionalUrl(value: unknown, policy: "any" | "github" | "linkedin") {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new ProfileDomainError("invalid_url");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ProfileDomainError("invalid_url");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
    throw new ProfileDomainError("invalid_url");
  }
  const host = url.hostname.toLowerCase();
  if (policy === "github" && host !== "github.com" && host !== "www.github.com") {
    throw new ProfileDomainError("invalid_url");
  }
  if (policy === "linkedin" && host !== "linkedin.com" && host !== "www.linkedin.com") {
    throw new ProfileDomainError("invalid_url");
  }
  if (policy !== "any" && url.pathname === "/") throw new ProfileDomainError("invalid_url");
  url.hash = "";
  return url.toString();
}

export function normalizeProfileInterests(input: unknown): string[] | null {
  if (input === null || input === undefined) return null;
  if (!Array.isArray(input) || input.length > 12) throw new ProfileDomainError("invalid_profile_field", "interests");
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") throw new ProfileDomainError("invalid_profile_field", "interests");
    const normalized = item.trim();
    if (!normalized) continue;
    if (normalized.length > 40) throw new ProfileDomainError("invalid_profile_field", "interests");
    const key = normalized.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length > 12) throw new ProfileDomainError("invalid_profile_field", "interests");
  }
  return result;
}

function normalizeDisplayName(value: unknown) {
  if (value === null || value === undefined) return null;
  return textValue(value, "displayName", 100, 2);
}

export function normalizeProfileFields(input: {
  handle?: unknown;
  displayName?: unknown;
  headline?: unknown;
  bio?: unknown;
  affiliation?: unknown;
  degrees?: unknown;
  websiteUrl?: unknown;
  githubUrl?: unknown;
  linkedinUrl?: unknown;
  interests?: unknown;
  visibility?: unknown;
  discoverable?: unknown;
}) {
  const visibility = input.visibility === undefined ? undefined : input.visibility;
  if (visibility !== undefined && visibility !== "private" && visibility !== "public") {
    throw new ProfileDomainError("invalid_visibility");
  }
  if (input.discoverable !== undefined && typeof input.discoverable !== "boolean") {
    throw new ProfileDomainError("invalid_profile_field", "discoverable");
  }
  return {
    ...(input.handle !== undefined ? { handle: input.handle === null ? null : normalizeProfileHandle(input.handle) } : {}),
    ...(input.displayName !== undefined ? { displayName: normalizeDisplayName(input.displayName) } : {}),
    ...(input.headline !== undefined ? { headline: textValue(input.headline, "headline", 160) } : {}),
    ...(input.bio !== undefined ? { bio: textValue(input.bio, "bio", 2000) } : {}),
    ...(input.affiliation !== undefined ? { affiliation: textValue(input.affiliation, "affiliation", 160) } : {}),
    ...(input.degrees !== undefined ? { degrees: textValue(input.degrees, "degrees", 120) } : {}),
    ...(input.websiteUrl !== undefined ? { websiteUrl: normalizeOptionalUrl(input.websiteUrl, "any") } : {}),
    ...(input.githubUrl !== undefined ? { githubUrl: normalizeOptionalUrl(input.githubUrl, "github") } : {}),
    ...(input.linkedinUrl !== undefined ? { linkedinUrl: normalizeOptionalUrl(input.linkedinUrl, "linkedin") } : {}),
    ...(input.interests !== undefined ? { interests: normalizeProfileInterests(input.interests) } : {}),
    ...(visibility !== undefined ? { visibility: visibility as ProfileVisibility } : {}),
    ...(input.discoverable !== undefined ? { discoverable: input.discoverable } : {}),
  };
}

function initialsFor(displayName: string) {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1
    ? `${words[0][0]}${words[words.length - 1][0]}`
    : words[0]?.slice(0, 2) || "?";
  return initials.toUpperCase();
}

function participantIdentityFromRow(row: {
  accountName: string | null;
  profileName: string | null;
  profileHandle: string | null;
  profileHeadline: string | null;
  profileAffiliation: string | null;
  profileVisibility: ProfileVisibility | null;
  profileDeactivatedAt: Date | null;
  accountStatus: string | null;
}): ParticipantIdentityData {
  const isPublic = row.profileVisibility === "public"
    && Boolean(row.profileName && row.profileHandle)
    && row.profileDeactivatedAt === null
    && (row.accountStatus === null || row.accountStatus === "active");
  const displayName = (isPublic ? row.profileName : row.accountName)?.trim() || "Team member";
  return {
    displayName,
    initials: initialsFor(displayName),
    handle: isPublic ? row.profileHandle : null,
    headline: isPublic ? row.profileHeadline : null,
    affiliation: isPublic ? row.profileAffiliation : null,
  };
}

/**
 * Resolve explicit account-backed identities in one query for a workspace.
 * Roster-only people never reach this function, and profile data never grants
 * access to the project or chat.
 */
export async function listParticipantIdentitiesForUsers(userIds: string[]): Promise<Map<string, ParticipantIdentityData>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const rows = await db.select({
    userId: users.id,
    accountName: users.name,
    profileName: userProfiles.displayName,
    profileHandle: userProfiles.handle,
    profileHeadline: userProfiles.headline,
    profileAffiliation: userProfiles.affiliation,
    profileVisibility: userProfiles.visibility,
    profileDeactivatedAt: userProfiles.deactivatedAt,
    accountStatus: userAccountControls.status,
  }).from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(userAccountControls, eq(userAccountControls.userId, users.id))
    .where(inArray(users.id, uniqueIds));
  type IdentityRow = Parameters<typeof participantIdentityFromRow>[0] & { userId: string };
  return new Map(rows.map((row: IdentityRow) => [row.userId, participantIdentityFromRow(row)]));
}

function isUniqueConstraint(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return code === "SQLITE_CONSTRAINT_UNIQUE" || String(error).toUpperCase().includes("UNIQUE constraint failed");
}

function editorData(profile: typeof userProfiles.$inferSelect): ProfileEditorData {
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    affiliation: profile.affiliation,
    degrees: profile.degrees,
    websiteUrl: profile.websiteUrl,
    githubUrl: profile.githubUrl,
    linkedinUrl: profile.linkedinUrl,
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    visibility: profile.visibility,
    discoverable: profile.discoverable,
    deactivatedAt: profile.deactivatedAt?.toISOString() ?? null,
  };

}

export function toProfileEditorData(profile: typeof userProfiles.$inferSelect): ProfileEditorData {
  return editorData(profile);
}

export function getProfileCompleteness(profile: ProfileEditorData | typeof userProfiles.$inferSelect): ProfileCompleteness {
  return calculateProfileCompleteness(profile);
}

function recordProfileAudit(input: {
  userId: string;
  action: "profile_created" | "profile_updated" | "profile_visibility_changed" | "profile_handle_changed" | "profile_discoverability_changed";
  metadata?: Record<string, unknown>;
}) {
  db.insert(auditEvents).values({
    id: nanoid(),
    entityType: "user_profile",
    entityId: input.userId,
    action: input.action,
    actorType: "user",
    actorId: input.userId,
    metadata: input.metadata ?? {},
    createdAt: new Date(),
  }).run();
}

/** Create a private shell only when profile functionality is explicitly used. */
export async function ensureOwnProfile(userId: string) {
  const [user] = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new ProfileDomainError("user_not_found");
  const [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (existing) return existing;

  const name = typeof user.name === "string" && user.name.trim().length >= 2
    ? user.name.trim().slice(0, 100)
    : null;
  const created = await db.insert(userProfiles).values({
    id: `profile_${nanoid(20)}`,
    userId,
    displayName: name,
    visibility: "private",
  }).onConflictDoNothing({ target: userProfiles.userId }).returning({ id: userProfiles.id });
  if (created.length > 0) {
    recordProfileAudit({ userId, action: "profile_created", metadata: { visibility: "private" } });
  }
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (!profile) throw new ProfileDomainError("profile_not_found");
  return profile;
}

export async function getOwnProfile(userId: string) {
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return profile ?? null;
}

/** Compare ownership without exposing the account identifier to a route. */
export async function ownsProfileHandle(userId: string, input: unknown): Promise<boolean> {
  let handle: string;
  try {
    handle = normalizeProfileHandle(input);
  } catch {
    return false;
  }
  const [profile] = await db.select({ id: userProfiles.id })
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, userId), eq(userProfiles.handle, handle)))
    .limit(1);
  return Boolean(profile);
}

/** Deactivation hides public identity while preserving all event history. */
export async function deactivateOwnProfile(userId: string) {
  await ensureOwnProfile(userId);
  await db.update(userProfiles).set({ deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(userProfiles.userId, userId));
  return getOwnProfile(userId);
}

export async function updateOwnProfile(userId: string, input: Parameters<typeof normalizeProfileFields>[0]) {
  const profile = await ensureOwnProfile(userId);
  const values = normalizeProfileFields(input);
  const nextVisibility = values.visibility ?? profile.visibility;
  const nextHandle = values.handle === undefined ? profile.handle : values.handle;
  const nextDisplayName = values.displayName === undefined ? profile.displayName : values.displayName;
  const nextDiscoverable = nextVisibility === "public"
    ? (values.discoverable === undefined ? profile.discoverable : values.discoverable)
    : false;
  if (nextVisibility === "public" && (!nextHandle || !nextDisplayName)) {
    throw new ProfileDomainError("invalid_profile_field", "public profile requires handle and display name");
  }
  const update = { ...values, discoverable: nextDiscoverable, updatedAt: new Date() };
  try {
    await db.update(userProfiles).set(update).where(eq(userProfiles.userId, userId));
  } catch (error) {
    if (isUniqueConstraint(error)) throw new ProfileDomainError("handle_taken");
    throw error;
  }
  const [updated] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (!updated) throw new ProfileDomainError("profile_not_found");
  const changedFields = Object.keys(values).filter((field) => field !== "visibility" && field !== "handle" && field !== "discoverable");
  if (changedFields.length > 0) {
    recordProfileAudit({ userId, action: "profile_updated", metadata: { fields: changedFields } });
  }
  if (values.visibility !== undefined && values.visibility !== profile.visibility) {
    recordProfileAudit({ userId, action: "profile_visibility_changed", metadata: { from: profile.visibility, to: values.visibility } });
  }
  if (values.handle !== undefined && values.handle !== profile.handle) {
    recordProfileAudit({ userId, action: "profile_handle_changed", metadata: { from: profile.handle, to: values.handle } });
  }
  if (nextDiscoverable !== profile.discoverable) {
    recordProfileAudit({ userId, action: "profile_discoverability_changed", metadata: { from: profile.discoverable, to: nextDiscoverable } });
  }
  return updated;
}

/**
 * Public resolution is deliberately generic: invalid, private, deactivated,
 * and disabled profiles all look like a missing handle to callers.
 */
export async function getPublicProfileByHandle(input: unknown): Promise<PublicParticipantProfile | null> {
  let handle: string;
  try {
    handle = normalizeProfileHandle(input);
  } catch {
    return null;
  }
  const rows = await db.select({
    handle: userProfiles.handle,
    displayName: userProfiles.displayName,
    headline: userProfiles.headline,
    bio: userProfiles.bio,
    affiliation: userProfiles.affiliation,
    degrees: userProfiles.degrees,
    websiteUrl: userProfiles.websiteUrl,
    githubUrl: userProfiles.githubUrl,
    linkedinUrl: userProfiles.linkedinUrl,
    interests: userProfiles.interests,
  }).from(userProfiles)
    .innerJoin(users, eq(users.id, userProfiles.userId))
    .leftJoin(userAccountControls, eq(userAccountControls.userId, userProfiles.userId))
    .where(and(
      eq(userProfiles.handle, handle),
      eq(userProfiles.visibility, "public"),
      isNull(userProfiles.deactivatedAt),
      or(isNull(userAccountControls.status), eq(userAccountControls.status, "active")),
    )).limit(1);
  const row = rows[0];
  if (!row?.handle || !row.displayName) return null;
  return {
    handle: row.handle,
    displayName: row.displayName,
    avatar: { kind: "initials", initials: initialsFor(row.displayName) },
    headline: row.headline,
    bio: row.bio,
    affiliation: row.affiliation,
    degrees: row.degrees,
    websiteUrl: row.websiteUrl,
    githubUrl: row.githubUrl,
    linkedinUrl: row.linkedinUrl,
    interests: Array.isArray(row.interests) ? row.interests : [],
  };
}

/**
 * Resolve the complete public page in one domain operation. This deliberately
 * keeps the internal user id inside the repository layer so a route cannot
 * accidentally use it as a public identifier or join on roster metadata.
 */
export async function getPublicProfilePageByHandle(input: unknown): Promise<PublicParticipantProfilePage | null> {
  let handle: string;
  try {
    handle = normalizeProfileHandle(input);
  } catch {
    return null;
  }
  const rows = await db.select({
    userId: userProfiles.userId,
    handle: userProfiles.handle,
    displayName: userProfiles.displayName,
    headline: userProfiles.headline,
    bio: userProfiles.bio,
    affiliation: userProfiles.affiliation,
    degrees: userProfiles.degrees,
    websiteUrl: userProfiles.websiteUrl,
    githubUrl: userProfiles.githubUrl,
    linkedinUrl: userProfiles.linkedinUrl,
    interests: userProfiles.interests,
  }).from(userProfiles)
    .innerJoin(users, eq(users.id, userProfiles.userId))
    .leftJoin(userAccountControls, eq(userAccountControls.userId, userProfiles.userId))
    .where(and(
      eq(userProfiles.handle, handle),
      eq(userProfiles.visibility, "public"),
      isNull(userProfiles.deactivatedAt),
      or(isNull(userAccountControls.status), eq(userAccountControls.status, "active")),
    )).limit(1);
  const row = rows[0];
  if (!row?.userId || !row.handle || !row.displayName) return null;
  const [projects, awards] = await Promise.all([
    listPublicProfileProjects(row.userId),
    listPublicProfileAwards(row.userId),
  ]);
  return {
    handle: row.handle,
    displayName: row.displayName,
    avatar: { kind: "initials", initials: initialsFor(row.displayName) },
    headline: row.headline,
    bio: row.bio,
    affiliation: row.affiliation,
    degrees: row.degrees,
    websiteUrl: row.websiteUrl,
    githubUrl: row.githubUrl,
    linkedinUrl: row.linkedinUrl,
    interests: Array.isArray(row.interests) ? row.interests : [],
    projects: projects.map((project) => ({
      projectId: project.projectId,
      projectTitle: project.projectTitle,
      teamName: project.teamName,
      eventSlug: project.eventSlug,
      eventName: project.eventName,
    })),
    awards: awards.map((award) => ({
      awardId: award.awardId,
      awardName: award.awardName,
      projectId: award.projectId,
      projectTitle: award.projectTitle,
      eventSlug: award.eventSlug,
      eventName: award.eventName,
    })),
  };
}

/**
 * Roster snapshots are event/submission data, not durable identity. These
 * projections join only explicit owner/membership relationships; an email or
 * matching name in team_members never creates project history.
 *
 * F.0A intentionally requires the D.4 event release to be published/archived.
 * This conservative boundary prevents a profile from exposing a finalized
 * but unpublished project while the future public-project policy is unified.
 */
export async function listPublicProfileProjects(userId: string): Promise<ProfileProjectHistoryItem[]> {
  const rows = await db.selectDistinct({
    projectId: submissions.id,
    projectTitle: submissions.projectTitle,
    teamName: submissions.teamName,
    eventSlug: events.slug,
    eventName: events.name,
    publicationState: publicationReleases.status,
  }).from(submissions)
    .innerJoin(events, eq(events.id, submissions.eventId))
    .innerJoin(publicationReleases, eq(publicationReleases.eventId, events.id))
    .leftJoin(submissionOwners, eq(submissionOwners.submissionId, submissions.id))
    .leftJoin(submissionMemberships, and(
      eq(submissionMemberships.submissionId, submissions.id),
      eq(submissionMemberships.userId, userId),
      eq(submissionMemberships.status, "active"),
    ))
    .where(and(
      inArray(publicationReleases.status, ["published", "archived"]),
      inArray(submissions.status, ["submitted", "finalized", "locked"]),
      or(
        eq(submissionOwners.userId, userId),
        eq(submissionMemberships.userId, userId),
      ),
    ));
  return rows.map((row: typeof rows[number]) => ({
    projectId: row.projectId,
    projectTitle: row.projectTitle?.trim() || "Untitled project",
    teamName: row.teamName,
    eventSlug: row.eventSlug,
    eventName: row.eventName,
    publicationState: row.publicationState as "published" | "archived",
  }));
}

/** Published recognition is derived from D.4 publication rows only. */
export async function listPublicProfileAwards(userId: string): Promise<ProfileAwardItem[]> {
  const rows = await db.selectDistinct({
    awardId: publicationAwards.id,
    awardName: publicationAwards.label,
    projectId: submissions.id,
    projectTitle: submissions.projectTitle,
    eventSlug: events.slug,
    eventName: events.name,
    publicationState: publicationReleases.status,
  }).from(publicationAwards)
    .innerJoin(publicationReleases, eq(publicationReleases.eventId, publicationAwards.eventId))
    .innerJoin(events, eq(events.id, publicationAwards.eventId))
    .innerJoin(submissions, eq(submissions.id, publicationAwards.submissionId))
    .leftJoin(submissionOwners, eq(submissionOwners.submissionId, submissions.id))
    .leftJoin(submissionMemberships, and(
      eq(submissionMemberships.submissionId, submissions.id),
      eq(submissionMemberships.userId, userId),
      eq(submissionMemberships.status, "active"),
    ))
    .where(and(
      eq(publicationAwards.status, "active"),
      inArray(publicationReleases.status, ["published", "archived"]),
      inArray(submissions.status, ["submitted", "finalized", "locked"]),
      or(eq(submissionOwners.userId, userId), eq(submissionMemberships.userId, userId)),
    ));
  return rows.map((row: typeof rows[number]) => ({
    awardId: row.awardId,
    awardName: row.awardName,
    projectId: row.projectId,
    projectTitle: row.projectTitle?.trim() || "Untitled project",
    eventSlug: row.eventSlug,
    eventName: row.eventName,
    publicationState: row.publicationState as "published" | "archived",
  }));
}

/**
 * Public links for authenticated project members. This is intentionally a
 * separate projection from the formal team roster: roster rows are snapshots
 * and must never be matched to accounts by name or email.
 */
export async function listPublicProfileLinksForSubmission(submissionId: string): Promise<PublicParticipantProfileLink[]> {
  const [ownerRows, memberRows] = await Promise.all([
    db.select({ handle: userProfiles.handle, displayName: userProfiles.displayName, headline: userProfiles.headline, affiliation: userProfiles.affiliation })
      .from(submissionOwners)
      .innerJoin(userProfiles, eq(userProfiles.userId, submissionOwners.userId))
      .innerJoin(users, eq(users.id, submissionOwners.userId))
      .leftJoin(userAccountControls, eq(userAccountControls.userId, submissionOwners.userId))
      .innerJoin(submissions, eq(submissions.id, submissionOwners.submissionId))
      .innerJoin(publicationReleases, eq(publicationReleases.eventId, submissions.eventId))
      .where(and(
        eq(submissionOwners.submissionId, submissionId),
        inArray(submissions.status, ["submitted", "finalized", "locked"]),
        inArray(publicationReleases.status, ["published", "archived"]),
        eq(userProfiles.visibility, "public"),
        isNull(userProfiles.deactivatedAt),
        or(isNull(userAccountControls.status), eq(userAccountControls.status, "active")),
      )),
    db.select({ handle: userProfiles.handle, displayName: userProfiles.displayName, headline: userProfiles.headline, affiliation: userProfiles.affiliation })
      .from(submissionMemberships)
      .innerJoin(userProfiles, eq(userProfiles.userId, submissionMemberships.userId))
      .innerJoin(users, eq(users.id, submissionMemberships.userId))
      .leftJoin(userAccountControls, eq(userAccountControls.userId, submissionMemberships.userId))
      .innerJoin(submissions, eq(submissions.id, submissionMemberships.submissionId))
      .innerJoin(publicationReleases, eq(publicationReleases.eventId, submissions.eventId))
      .where(and(
        eq(submissionMemberships.submissionId, submissionId),
        eq(submissionMemberships.status, "active"),
        inArray(submissions.status, ["submitted", "finalized", "locked"]),
        inArray(publicationReleases.status, ["published", "archived"]),
        eq(userProfiles.visibility, "public"),
        isNull(userProfiles.deactivatedAt),
        or(isNull(userAccountControls.status), eq(userAccountControls.status, "active")),
      )),
  ]);
  const links = new Map<string, PublicParticipantProfileLink>();
  for (const row of [...ownerRows, ...memberRows]) {
    if (row.handle && row.displayName) links.set(row.handle, {
      handle: row.handle,
      displayName: row.displayName,
      headline: row.headline,
      affiliation: row.affiliation,
    });
  }
  return [...links.values()];
}
