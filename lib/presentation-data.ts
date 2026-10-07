import { and, count, eq, inArray } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiReviews, audienceVotes, submissions, teamMembers } from "@/lib/db/schema";
import { getAwardBadgeMap, type AwardBadge } from "@/lib/award-badges";
import { getActiveEvent } from "@/lib/events";
import { audienceVotingStatus } from "@/lib/events";
import { resolveInstitutionGeo, getEventHostLocation, type GeoLocation, type EventHub } from "@/lib/institution-geo";
import { resolveScreenshotUrls } from "@/lib/screenshots";
import { toPublicTeamMembers, type PublicTeamMember } from "@/lib/team-display";

type SubmissionRow = InferSelectModel<typeof submissions>;
type TeamMemberRow = InferSelectModel<typeof teamMembers>;
type AiReviewRow = InferSelectModel<typeof aiReviews>;
type VoteCountRow = { submissionId: string; total: number };

export interface PresentationProject {
  id: string;
  status: string;
  isInProgress: boolean;
  projectTitle: string | null;
  teamName: string;
  problemStatement: string | null;
  screenshotUrl: string | null;
  demoUrl: string | null;
  demoVideoUrl: string | null;
  githubUrl: string | null;
  tags: string[];
  audienceVotes: number | null;
  aiScore: number | null;
  awards: AwardBadge[];
  teamMembers: PublicTeamMember[];
  leadInstitution: string | null;
  leadGeo: GeoLocation | null;
  institutions: Array<{
    name: string;
    geo: GeoLocation | null;
    role: "lead" | "member";
  }>;
  contentSignalCount: number;
}

export interface PresentationInstitution {
  name: string;
  participants: number;
  teams: number;
  students: number;
  geo: GeoLocation;
}

export interface PresentationLiveData {
  generatedAt: string;
  hub: EventHub;
  projects: PresentationProject[];
  institutions: PresentationInstitution[];
}

export interface PresentationEligibilityRow {
  submissionId: string;
  projectTitle: string | null;
  teamName: string;
  status: string;
  eligible: boolean;
  isInProgress: boolean;
  memberCount: number;
  geocodedInstitutionCount: number;
  institutions: string[];
  contentSignalCount: number;
  contentSignals: string[];
  missingReasons: string[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function contentSignals(sub: SubmissionRow): string[] {
  const signals: string[] = [];
  if (sub.problemStatement?.trim()) signals.push("problemStatement");
  if (sub.problemStatement && sub.problemStatement.trim().length >= 80) signals.push("shortProjectDescription");
  if (resolveScreenshotUrls(sub).length > 0) signals.push("screenshot");
  if (sub.demoUrl?.trim()) signals.push("demoUrl");
  if (sub.githubUrl?.trim()) signals.push("githubUrl");
  if (sub.agentsMdUrl?.trim()) signals.push("agentsMd");
  if (sub.sampleDataDescription?.trim()) signals.push("sampleDataNotes");
  if (sub.status === "finalized" || sub.status === "locked") signals.push("finalizedStatus");
  return signals;
}

function isPresentationEligible(sub: SubmissionRow, publicMembers: PublicTeamMember[], institutions: Array<{ geo: GeoLocation | null }>): boolean {
  if (!sub.teamName?.trim()) return false;
  if (publicMembers.length === 0) return false;
  if (!institutions.some((institution) => institution.geo)) return false;
  if (!(sub.projectTitle?.trim() || sub.teamName?.trim())) return false;
  return contentSignals(sub).length >= 2;
}

function presentationMissingReasons(sub: SubmissionRow, publicMembers: PublicTeamMember[], institutions: Array<{ geo: GeoLocation | null }>, signals: string[]): string[] {
  const reasons: string[] = [];
  if (!sub.teamName?.trim()) reasons.push("Missing team name");
  if (publicMembers.length === 0) reasons.push("No public-safe team members");
  if (!institutions.some((institution) => institution.geo)) reasons.push("No geocoded public institution");
  if (!(sub.projectTitle?.trim() || sub.teamName?.trim())) reasons.push("Missing project title/name");
  if (signals.length < 2) reasons.push(`Only ${signals.length}/2 content signals`);
  return reasons;
}

function projectInstitutionsFromMembers(ordered: TeamMemberRow[]) {
  const institutionRoles = new Map<string, "lead" | "member">();
  for (const member of ordered) {
    const aff = member.affiliation?.trim();
    if (!aff) continue;
    const role = member.order === 0 ? "lead" : "member";
    if (!institutionRoles.has(aff) || role === "lead") institutionRoles.set(aff, role);
  }
  return Array.from(institutionRoles.entries()).map(([name, role]) => ({
    name,
    geo: resolveInstitutionGeo(name),
    role,
  }));
}

async function loadPresentationSourceRows() {
  const subRows: SubmissionRow[] = await db.select().from(submissions);
  const subIds = subRows.map((sub: SubmissionRow) => sub.id);
  if (subIds.length === 0) return { subRows, memberRows: [] as TeamMemberRow[] };
  const memberRows: TeamMemberRow[] = await db.select().from(teamMembers).where(inArray(teamMembers.submissionId, subIds));
  return { subRows, memberRows };
}

export async function getPresentationEligibilityRows(): Promise<PresentationEligibilityRow[]> {
  const { subRows, memberRows } = await loadPresentationSourceRows();
  const membersBySub = new Map<string, TeamMemberRow[]>();
  for (const member of memberRows) {
    const list = membersBySub.get(member.submissionId) ?? [];
    list.push(member);
    membersBySub.set(member.submissionId, list);
  }

  return subRows.map((sub) => {
    const ordered = [...(membersBySub.get(sub.id) ?? [])].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const publicMembers = toPublicTeamMembers(ordered);
    const institutions = projectInstitutionsFromMembers(ordered);
    const signals = contentSignals(sub);
    const missingReasons = presentationMissingReasons(sub, publicMembers, institutions, signals);
    return {
      submissionId: sub.id,
      projectTitle: sub.projectTitle,
      teamName: sub.teamName,
      status: sub.status,
      eligible: isPresentationEligible(sub, publicMembers, institutions),
      isInProgress: sub.status !== "finalized" && sub.status !== "locked",
      memberCount: publicMembers.length,
      geocodedInstitutionCount: institutions.filter((institution) => institution.geo).length,
      institutions: institutions.filter((institution) => institution.geo).map((institution) => institution.name),
      contentSignalCount: signals.length,
      contentSignals: signals,
      missingReasons,
    };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.teamName.localeCompare(b.teamName));
}

export async function getPresentationLiveData(): Promise<PresentationLiveData> {
  const event = await getActiveEvent();
  const voting = audienceVotingStatus(event);

  const { subRows, memberRows } = await loadPresentationSourceRows();
  const subIds = subRows.map((sub: SubmissionRow) => sub.id);

  if (subIds.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      hub: getEventHostLocation(),
      projects: [],
      institutions: [],
    };
  }

  const [voteRows, reviewRows, awardMap]: [VoteCountRow[], AiReviewRow[], Awaited<ReturnType<typeof getAwardBadgeMap>>] = await Promise.all([
    db.select({ submissionId: audienceVotes.submissionId, total: count() })
      .from(audienceVotes)
      .where(inArray(audienceVotes.submissionId, subIds))
      .groupBy(audienceVotes.submissionId),
    db.select().from(aiReviews).where(and(inArray(aiReviews.submissionId, subIds), eq(aiReviews.status, "complete"))),
    getAwardBadgeMap({ event }),
  ]);

  const membersBySub = new Map<string, TeamMemberRow[]>();
  for (const member of memberRows) {
    const list = membersBySub.get(member.submissionId) ?? [];
    list.push(member);
    membersBySub.set(member.submissionId, list);
  }

  const votesBySub = new Map(voteRows.map((row: VoteCountRow) => [row.submissionId, row.total]));
  const aiBySub = new Map<string, number>();
  for (const review of reviewRows) {
    if (typeof review.generatedScore !== "number") continue;
    const existing = aiBySub.get(review.submissionId);
    aiBySub.set(review.submissionId, existing === undefined ? review.generatedScore : Math.max(existing, review.generatedScore));
  }

  const candidateProjects: PresentationProject[] = subRows.map((sub) => {
    const rawMembers = membersBySub.get(sub.id) ?? [];
    const ordered = [...rawMembers].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const lead = ordered[0];
    const leadInstitution = lead?.affiliation?.trim() || ordered.find((member) => member.affiliation?.trim())?.affiliation?.trim() || null;
    const leadGeo = leadInstitution ? resolveInstitutionGeo(leadInstitution) : null;
    const publicMembers = toPublicTeamMembers(ordered);
    const projectInstitutions = projectInstitutionsFromMembers(ordered);
    const signals = contentSignals(sub);
    return {
      id: sub.id,
      status: sub.status,
      isInProgress: sub.status !== "finalized" && sub.status !== "locked",
      projectTitle: sub.projectTitle,
      teamName: sub.teamName,
      problemStatement: sub.problemStatement,
      screenshotUrl: resolveScreenshotUrls(sub)[0] ?? null,
      demoUrl: sub.demoUrl,
      demoVideoUrl: sub.demoVideoUrl,
      githubUrl: sub.githubUrl,
      tags: Array.isArray(sub.tags) ? sub.tags.slice(0, 5) : [],
      audienceVotes: !["draft"].includes(sub.status) && (voting.resultsVisible || event.winnersPublishedAt) ? votesBySub.get(sub.id) ?? 0 : null,
      aiScore: sub.status === "finalized" || sub.status === "locked" ? (aiBySub.has(sub.id) ? round1(aiBySub.get(sub.id)!) : null) : null,
      awards: sub.status === "finalized" || sub.status === "locked" ? awardMap[sub.id] ?? [] : [],
      teamMembers: publicMembers,
      leadInstitution,
      leadGeo,
      institutions: projectInstitutions,
      contentSignalCount: signals.length,
    };
  });

  const projects = candidateProjects
    .filter((project) => {
      const sub = subRows.find((row) => row.id === project.id);
      return sub ? isPresentationEligible(sub, project.teamMembers, project.institutions) : false;
    })
    .sort((a, b) => Number(Boolean(b.leadGeo)) - Number(Boolean(a.leadGeo)) || a.teamName.localeCompare(b.teamName));

  const eligibleIds = new Set(projects.map((project) => project.id));
  const instMap = new Map<string, { teams: Set<string>; participants: number; students: number; geo: GeoLocation }>();
  for (const member of memberRows) {
    if (!eligibleIds.has(member.submissionId)) continue;
    const aff = member.affiliation?.trim();
    if (!aff) continue;
    const geo = resolveInstitutionGeo(aff);
    if (!geo) continue;
    const entry = instMap.get(aff) ?? { teams: new Set<string>(), participants: 0, students: 0, geo };
    entry.teams.add(member.submissionId);
    entry.participants += 1;
    if (member.isStudentTrainee) entry.students += 1;
    instMap.set(aff, entry);
  }

  const institutions: PresentationInstitution[] = Array.from(instMap.entries())
    .map(([name, data]) => ({
      name,
      participants: data.participants,
      teams: data.teams.size,
      students: data.students,
      geo: data.geo,
    }))
    .sort((a, b) => b.participants - a.participants || a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    hub: getEventHostLocation(),
    projects,
    institutions,
  };
}
