import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  publicationReleases,
  submissionMemberships,
  submissionOwners,
  submissions,
  userAccountControls,
  userProfiles,
  users,
} from "@/lib/db/schema";

const DIRECTORY_PAGE_SIZE = 24;
const MAX_SEARCH_LENGTH = 80;
const MAX_FILTER_LENGTH = 160;

export type DiscoverableParticipantProject = {
  projectId: string;
  projectTitle: string;
  teamName: string;
  eventName: string;
  eventSlug: string;
};

export type DiscoverableParticipantCard = {
  handle: string;
  displayName: string;
  initials: string;
  headline: string | null;
  affiliation: string | null;
  interests: string[];
  projects: DiscoverableParticipantProject[];
  /** The only directory-relative exception to the universal Message action. */
  isSelf: boolean;
};

export type PeopleDirectoryQuery = {
  search?: string | null;
  interest?: string | null;
  institution?: string | null;
  page?: number | string | null;
  /** Internal viewer context; never serialized into the URL or card. */
  viewerUserId?: string | null;
};

export type PeopleDirectoryResult = {
  cards: DiscoverableParticipantCard[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  interest: string;
  institution: string;
  interestOptions: string[];
  institutionOptions: string[];
};

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizedSearch(value: unknown) {
  return clean(value, MAX_SEARCH_LENGTH).toLocaleLowerCase("en-US");
}

function normalizedFilter(value: unknown) {
  return clean(value, MAX_FILTER_LENGTH);
}

function parsePage(value: unknown) {
  const page = typeof value === "string" ? Number.parseInt(value, 10) : typeof value === "number" ? value : 1;
  return Number.isFinite(page) ? Math.max(1, Math.min(1000, Math.floor(page))) : 1;
}

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : words[0]?.slice(0, 2) || "?").toUpperCase();
}

function parseInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => {
      const key = item.toLocaleLowerCase("en-US");
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function publicProjectSearchForEvent(eventId: string, pattern: string) {
  return sql`EXISTS (
    SELECT 1 FROM submissions searchable_submission
    INNER JOIN publication_releases searchable_release
      ON searchable_release.event_id = searchable_submission.event_id
    LEFT JOIN submission_owners searchable_owner
      ON searchable_owner.submission_id = searchable_submission.id
    LEFT JOIN submission_memberships searchable_member
      ON searchable_member.submission_id = searchable_submission.id
      AND searchable_member.status = 'active'
    WHERE searchable_submission.event_id = ${eventId}
      AND searchable_release.status IN ('published', 'archived')
      AND searchable_submission.status IN ('submitted', 'finalized', 'locked')
      AND (searchable_owner.user_id = ${userProfiles.userId}
        OR searchable_member.user_id = ${userProfiles.userId})
      AND (lower(coalesce(searchable_submission.project_title, '')) LIKE ${pattern}
        OR lower(coalesce(searchable_submission.team_name, '')) LIKE ${pattern})
  )`;
}

function directoryWhere(eventId: string, query: { search: string; interest: string; institution: string }) {
  const conditions = [
    eq(userProfiles.visibility, "public"),
    eq(userProfiles.discoverable, true),
    isNull(userProfiles.deactivatedAt),
    or(isNull(userAccountControls.status), eq(userAccountControls.status, "active")),
  ];
  if (query.interest) {
    conditions.push(sql`lower(coalesce(CAST(${userProfiles.interests} AS TEXT), '')) LIKE ${`%${query.interest.toLocaleLowerCase("en-US")}%`}`);
  }
  if (query.institution) {
    conditions.push(sql`lower(coalesce(${userProfiles.affiliation}, '')) = ${query.institution.toLocaleLowerCase("en-US")}`);
  }
  if (query.search) {
    const pattern = `%${query.search}%`;
    conditions.push(or(
      sql`lower(coalesce(${userProfiles.displayName}, '')) LIKE ${pattern}`,
      sql`lower(coalesce(${userProfiles.headline}, '')) LIKE ${pattern}`,
      sql`lower(coalesce(${userProfiles.affiliation}, '')) LIKE ${pattern}`,
      sql`lower(coalesce(CAST(${userProfiles.interests} AS TEXT), '')) LIKE ${pattern}`,
      publicProjectSearchForEvent(eventId, pattern),
    ));
  }
  return and(...conditions);
}

async function filterOptions(eventId: string) {
  const rows = await db.select({ affiliation: userProfiles.affiliation, interests: userProfiles.interests })
    .from(userProfiles)
    .innerJoin(users, eq(users.id, userProfiles.userId))
    .leftJoin(userAccountControls, eq(userAccountControls.userId, userProfiles.userId))
    .where(directoryWhere(eventId, { search: "", interest: "", institution: "" }));
  const institutions = new Map<string, string>();
  const interests = new Map<string, string>();
  for (const row of rows) {
    const affiliation = row.affiliation?.trim();
    if (affiliation) institutions.set(affiliation.toLocaleLowerCase("en-US"), affiliation);
    for (const interest of parseInterests(row.interests)) interests.set(interest.toLocaleLowerCase("en-US"), interest);
  }
  return {
    institutionOptions: [...institutions.values()].sort((a, b) => a.localeCompare(b)),
    interestOptions: [...interests.values()].sort((a, b) => a.localeCompare(b)),
  };
}

async function projectsForUsers(eventId: string, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, DiscoverableParticipantProject[]>();
  const [owners, members] = await Promise.all([
    db.select({ userId: submissionOwners.userId, projectId: submissions.id, projectTitle: submissions.projectTitle, teamName: submissions.teamName, eventName: events.name, eventSlug: events.slug })
      .from(submissionOwners)
      .innerJoin(submissions, eq(submissions.id, submissionOwners.submissionId))
      .innerJoin(events, eq(events.id, submissions.eventId))
      .innerJoin(publicationReleases, eq(publicationReleases.eventId, submissions.eventId))
      .where(and(eq(submissions.eventId, eventId), inArray(submissionOwners.userId, userIds), inArray(publicationReleases.status, ["published", "archived"]), inArray(submissions.status, ["submitted", "finalized", "locked"]))),
    db.select({ userId: submissionMemberships.userId, projectId: submissions.id, projectTitle: submissions.projectTitle, teamName: submissions.teamName, eventName: events.name, eventSlug: events.slug })
      .from(submissionMemberships)
      .innerJoin(submissions, eq(submissions.id, submissionMemberships.submissionId))
      .innerJoin(events, eq(events.id, submissions.eventId))
      .innerJoin(publicationReleases, eq(publicationReleases.eventId, submissions.eventId))
      .where(and(eq(submissions.eventId, eventId), eq(submissionMemberships.status, "active"), inArray(submissionMemberships.userId, userIds), inArray(publicationReleases.status, ["published", "archived"]), inArray(submissions.status, ["submitted", "finalized", "locked"]))),
  ]);
  const grouped = new Map<string, DiscoverableParticipantProject[]>();
  for (const row of [...owners, ...members]) {
    if (!row.userId) continue;
    const list = grouped.get(row.userId) ?? [];
    if (!list.some((project) => project.projectId === row.projectId)) {
      list.push({ projectId: row.projectId, projectTitle: row.projectTitle?.trim() || "Untitled project", teamName: row.teamName, eventName: row.eventName, eventSlug: row.eventSlug });
    }
    grouped.set(row.userId, list.slice(0, 2));
  }
  return grouped;
}

/** Safe platform-social directory projection. Project listings remain current-event scoped; internal IDs never leave this module. */
export async function listPeopleDirectory(eventId: string, input: PeopleDirectoryQuery = {}): Promise<PeopleDirectoryResult> {
  const search = normalizedSearch(input.search);
  const interest = normalizedFilter(input.interest);
  const institution = normalizedFilter(input.institution);
  const page = parsePage(input.page);
  const viewerUserId = typeof input.viewerUserId === "string" ? input.viewerUserId : null;
  const where = directoryWhere(eventId, { search, interest, institution });
  const countPromise = db.select({ total: sql<number>`count(*)` }).from(userProfiles).innerJoin(users, eq(users.id, userProfiles.userId)).leftJoin(userAccountControls, eq(userAccountControls.userId, userProfiles.userId)).where(where);
  const [countRows, options] = await Promise.all([countPromise, filterOptions(eventId)]);
  const total = countRows[0]?.total;
  const totalCount = Number(total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / DIRECTORY_PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);
  const rawRows = await db.select({ userId: userProfiles.userId, handle: userProfiles.handle, displayName: userProfiles.displayName, headline: userProfiles.headline, affiliation: userProfiles.affiliation, interests: userProfiles.interests })
    .from(userProfiles).innerJoin(users, eq(users.id, userProfiles.userId)).leftJoin(userAccountControls, eq(userAccountControls.userId, userProfiles.userId)).where(where).orderBy(asc(sql`lower(${userProfiles.displayName})`), asc(userProfiles.handle)).limit(DIRECTORY_PAGE_SIZE).offset((effectivePage - 1) * DIRECTORY_PAGE_SIZE);
  type DirectoryRow = { userId: string | null; handle: string | null; displayName: string | null; headline: string | null; affiliation: string | null; interests: unknown };
  const rows = rawRows as DirectoryRow[];
  const safeRows = rows.filter((row: DirectoryRow) => row.userId && row.handle && row.displayName).map((row: DirectoryRow) => ({ ...row, userId: row.userId as string, handle: row.handle as string, displayName: row.displayName as string }));
  const safeUserIds = safeRows.map((row: DirectoryRow & { userId: string; handle: string; displayName: string }) => row.userId);
  const projects = await projectsForUsers(eventId, safeUserIds);
  return {
    cards: safeRows.map((row: DirectoryRow & { userId: string; handle: string; displayName: string }) => ({ handle: row.handle, displayName: row.displayName, initials: initialsFor(row.displayName), headline: row.headline, affiliation: row.affiliation, interests: parseInterests(row.interests), projects: projects.get(row.userId) ?? [], isSelf: viewerUserId === row.userId })),
    page: effectivePage, pageSize: DIRECTORY_PAGE_SIZE, total: totalCount, totalPages,
    search, interest, institution, ...options,
  };
}
