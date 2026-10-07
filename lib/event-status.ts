import { db } from "@/lib/db";
import { resolveInstitutionGeo, type GeoLocation } from "@/lib/institution-geo";
export type { GeoLocation };
import {
  submissions,
  teamMembers,
  audienceVotes,
  aiReviews,
  humanScores,
  judgeAssignments,
  auditEvents,
  publicationReleases,
} from "@/lib/db/schema";
import {
  audienceVotingStatus,
  submissionDeadlineStatus,
  judgingDeadlineStatus,
} from "@/lib/events";
import { eq, sql, desc } from "drizzle-orm";
import type { EventRow } from "@/lib/events";

// ── Stage ─────────────────────────────────────────────────────────────────────

export interface EventStage {
  label: string;
  pulse: boolean;
  colorClass: "success" | "warning" | "accent-2" | "muted";
}

export function deriveEventStage(event: EventRow, publicationStatus?: string | null): EventStage {
  const voting = audienceVotingStatus(event);
  if (event.isFrozen) return { label: "Event Frozen", pulse: false, colorClass: "muted" };
  const resultsPublished = publicationStatus !== undefined
    ? publicationStatus === "published" || publicationStatus === "archived"
    : Boolean(event.winnersPublishedAt);
  if (resultsPublished) return { label: "Results Published", pulse: false, colorClass: "warning" };
  if (voting.open) return { label: "Audience Voting Open", pulse: true, colorClass: "success" };
  const subStatus = submissionDeadlineStatus(event);
  const judgeStatus = judgingDeadlineStatus(event);
  if (!subStatus.open && judgeStatus.open) return { label: "Judging In Progress", pulse: true, colorClass: "accent-2" };
  if (subStatus.open) return { label: "Submissions Open", pulse: true, colorClass: "success" };
  return { label: "Event Closed", pulse: false, colorClass: "muted" };
}

export function deriveCountdownTarget(event: EventRow): { label: string; targetMs: number } | null {
  const now = Date.now();
  const voting = audienceVotingStatus(event);
  if (voting.open && event.audienceVotingEndsAt && event.audienceVotingEndsAt.getTime() > now) {
    return { label: "Voting closes in", targetMs: event.audienceVotingEndsAt.getTime() };
  }
  const subStatus = submissionDeadlineStatus(event);
  const judgeStatus = judgingDeadlineStatus(event);
  if (!subStatus.open && judgeStatus.open && event.judgingDeadline && event.judgingDeadline.getTime() > now) {
    return { label: "Judging closes in", targetMs: event.judgingDeadline.getTime() };
  }
  if (subStatus.open && event.submissionDeadline && event.submissionDeadline.getTime() > now) {
    return { label: "Submissions close in", targetMs: event.submissionDeadline.getTime() };
  }
  return null;
}

// ── Data types ────────────────────────────────────────────────────────────────

export interface StatusMetrics {
  totalRegistrations: number;
  projectsFinalized: number;
  prizeEligibleTeams: number;
  studentParticipants: number;
  institutionsCount: number;
  audienceVotesTotal: number;
  aiEvalsCompleted: number;
  judgeScorecardsCompleted: number;
}

export interface InstitutionRow {
  name: string;
  teams: number;
  participants: number;
  students: number;
  geo?: GeoLocation;
}

export interface LeaderboardEntry {
  submissionId: string;
  projectTitle: string | null;
  teamName: string;
  score: number;
  linkable: boolean;
}

export interface ActivityItem {
  key: string;
  icon: string;
  label: string;
  detail: string | null;
  timestamp: Date;
}

export interface StatusBreakdown {
  draft: number;
  submitted: number;
  finalized: number;
  prizeEligible: number;
  prizeIncomplete: number;
  students: number;
  others: number;
}

export interface StatusPageData {
  metrics: StatusMetrics;
  institutions: InstitutionRow[];
  maxInstitutionTeams: number;
  audienceLeaderboard: LeaderboardEntry[] | null;
  aiLeaderboard: LeaderboardEntry[];
  officialLeaderboard: LeaderboardEntry[] | null;
  recentActivity: ActivityItem[];
  breakdown: StatusBreakdown;
  votingOpen: boolean;
  resultsVisible: boolean;
  submissionsOpen: boolean;
  winnersPublished: boolean;
  updatedAt: Date;
}

// ── Main data fetch ───────────────────────────────────────────────────────────

export async function getStatusPageData(event: EventRow): Promise<StatusPageData> {
  const voting = audienceVotingStatus(event);
  const subStatus = submissionDeadlineStatus(event);
  const now = new Date();
  const publication = (await db.select({ status: publicationReleases.status, publishedAt: publicationReleases.publishedAt }).from(publicationReleases).where(eq(publicationReleases.eventId, event.id)).limit(1))[0] ?? null;
  const resultsPublished = publication?.status === "published" || publication?.status === "archived";

  const [
    allSubs,
    allMembers,
    totalVotes,
    votesBySubmission,
    completedReviews,
    humanScoreCount,
    assignmentCount,
    recentVoteRows,
    auditRows,
  ]: [
    { id: string; teamName: string; projectTitle: string | null; status: string; createdAt: Date; finalizedAt: Date | null }[],
    { submissionId: string; affiliation: string | null; isStudentTrainee: boolean | null; badgeNumber: string | null }[],
    { count: number }[],
    { submissionId: string; count: number }[],
    { submissionId: string; generatedScore: number | null; createdAt: Date }[],
    { count: number }[],
    { count: number }[],
    { submissionId: string; createdAt: Date }[],
    { id: string; action: string; createdAt: Date }[],
  ] = await Promise.all([
    db.select({
      id: submissions.id,
      teamName: submissions.teamName,
      projectTitle: submissions.projectTitle,
      status: submissions.status,
      createdAt: submissions.createdAt,
      finalizedAt: submissions.finalizedAt,
    }).from(submissions),

    db.select({
      submissionId: teamMembers.submissionId,
      affiliation: teamMembers.affiliation,
      isStudentTrainee: teamMembers.isStudentTrainee,
      badgeNumber: teamMembers.badgeNumber,
    }).from(teamMembers),

    db.select({ count: sql<number>`cast(count(*) as integer)` }).from(audienceVotes),

    db.select({
      submissionId: audienceVotes.submissionId,
      count: sql<number>`cast(count(*) as integer)`,
    }).from(audienceVotes).groupBy(audienceVotes.submissionId),

    db.select({
      submissionId: aiReviews.submissionId,
      generatedScore: aiReviews.generatedScore,
      createdAt: aiReviews.createdAt,
    }).from(aiReviews).where(eq(aiReviews.status, "complete")),

    db.select({ count: sql<number>`cast(count(*) as integer)` })
      .from(humanScores)
      .where(eq(humanScores.completed, true)),

    db.select({ count: sql<number>`cast(count(*) as integer)` })
      .from(judgeAssignments),

    db.select({
      submissionId: audienceVotes.submissionId,
      createdAt: audienceVotes.createdAt,
    }).from(audienceVotes).orderBy(desc(audienceVotes.createdAt)).limit(10),

    db.select({
      id: auditEvents.id,
      action: auditEvents.action,
      createdAt: auditEvents.createdAt,
    }).from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(30),
  ]);

  // Index submissions
  type SubRow = (typeof allSubs)[number];
  const subById = Object.fromEntries(allSubs.map((s: SubRow) => [s.id, s]));

  // Status counts
  const statusCounts = { draft: 0, submitted: 0, finalized: 0 };
  for (const s of allSubs) {
    if (s.status === "draft") statusCounts.draft++;
    else if (s.status === "submitted") statusCounts.submitted++;
    else if (s.status === "finalized" || s.status === "locked") statusCounts.finalized++;
  }

  // Group members by submission
  type MemberRow = (typeof allMembers)[number];
  const membersBySub: Record<string, MemberRow[]> = {};
  for (const m of allMembers) {
    (membersBySub[m.submissionId] ??= []).push(m);
  }

  // Institution aggregation (team-based, privacy-safe)
  const instMap: Record<string, { teams: Set<string>; participants: number; students: number }> = {};
  for (const m of allMembers) {
    const aff = m.affiliation?.trim();
    if (!aff) continue;
    const entry = (instMap[aff] ??= { teams: new Set(), participants: 0, students: 0 });
    entry.teams.add(m.submissionId);
    entry.participants++;
    if (m.isStudentTrainee) entry.students++;
  }
  const institutions: InstitutionRow[] = Object.entries(instMap)
    .map(([name, d]) => ({
      name,
      teams: d.teams.size,
      participants: d.participants,
      students: d.students,
      geo: resolveInstitutionGeo(name),
    }))
    .sort((a, b) => b.teams - a.teams || b.participants - a.participants)
    .slice(0, 10);
  const maxInstitutionTeams = institutions[0]?.teams ?? 1;

  // Prize eligibility (all submissions)
  let prizeEligible = 0;
  let prizeIncomplete = 0;
  for (const sub of allSubs) {
    const members = membersBySub[sub.id] ?? [];
    const eligible = members.length > 0 && members.every((m) => m.badgeNumber?.trim());
    if (eligible) prizeEligible++;
    else prizeIncomplete++;
  }

  // Participant counts
  const students = allMembers.filter((m: MemberRow) => m.isStudentTrainee).length;
  const others = allMembers.filter((m: MemberRow) => !m.isStudentTrainee).length;

  // Metrics
  const metrics: StatusMetrics = {
    totalRegistrations: allSubs.length,
    projectsFinalized: statusCounts.finalized,
    prizeEligibleTeams: prizeEligible,
    studentParticipants: students,
    institutionsCount: Object.keys(instMap).length,
    audienceVotesTotal: totalVotes[0]?.count ?? 0,
    aiEvalsCompleted: completedReviews.length,
    judgeScorecardsCompleted: humanScoreCount[0]?.count ?? 0,
  };

  // Vote map
  const voteMap = Object.fromEntries(votesBySubmission.map((r) => [r.submissionId, r.count]));

  // Audience leaderboard — show per-project results if resultsVisible or winners published
  let audienceLeaderboard: LeaderboardEntry[] | null = null;
  if (voting.resultsVisible || resultsPublished) {
    audienceLeaderboard = allSubs
      .map((s) => ({
        submissionId: s.id,
        projectTitle: s.projectTitle,
        teamName: s.teamName,
        score: voteMap[s.id] ?? 0,
        linkable: s.status === "finalized" || s.status === "locked" || s.status === "submitted",
      }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  // AI eval leaderboard
  const aiLeaderboard: LeaderboardEntry[] = completedReviews
    .filter((r) => r.generatedScore !== null)
    .map((r) => {
      const sub = subById[r.submissionId];
      return {
        submissionId: r.submissionId,
        projectTitle: sub?.projectTitle ?? null,
        teamName: sub?.teamName ?? "Unknown",
        score: r.generatedScore!,
        linkable: sub?.status === "finalized" || sub?.status === "locked" || sub?.status === "submitted",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Official leaderboard — only if winners published
  let officialLeaderboard: LeaderboardEntry[] | null = null;
  if (resultsPublished) {
    const { getRankingData } = await import("@/lib/rankings");
    const { rankings } = await getRankingData();
    officialLeaderboard = rankings
      .filter((r) => r.officialScore !== null)
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
      .slice(0, 10)
      .map((r) => ({
        submissionId: r.submissionId,
        projectTitle: r.projectTitle,
        teamName: r.teamName,
        score: Math.round((r.officialScore ?? 0) * 10) / 10,
        linkable: true,
      }));
  }

  // Recent activity — all public events sorted desc, capped at 12
  const activity: ActivityItem[] = [];

  for (const s of allSubs) {
    activity.push({
      key: `reg-${s.id}`,
      icon: "🎯",
      label: "Team registered",
      detail: s.teamName,
      timestamp: s.createdAt,
    });
    if (s.finalizedAt) {
      activity.push({
        key: `fin-${s.id}`,
        icon: "✅",
        label: "Project finalized",
        detail: s.projectTitle ?? s.teamName,
        timestamp: s.finalizedAt,
      });
    }
  }

  for (const r of completedReviews) {
    const sub = subById[r.submissionId];
    activity.push({
      key: `eval-${r.submissionId}`,
      icon: "🤖",
      label: "AI evaluation completed",
      detail: sub?.projectTitle ?? sub?.teamName ?? null,
      timestamp: r.createdAt,
    });
  }

  for (const v of recentVoteRows) {
    const sub = subById[v.submissionId];
    activity.push({
      key: `vote-${v.submissionId}-${v.createdAt.getTime()}`,
      icon: "❤️",
      label: "Audience vote cast",
      detail: sub?.projectTitle ?? sub?.teamName ?? null,
      timestamp: v.createdAt,
    });
  }

  if (resultsPublished) {
    activity.push({
      key: "winners-published",
      icon: "🏆",
      label: "Winners announced",
      detail: null,
      // D.4 publication is authoritative; older fixtures may not have the
      // legacy event timestamp populated.
      timestamp: publication?.publishedAt ?? event.winnersPublishedAt ?? now,
    });
  }

  for (const log of auditRows) {
    if (log.action.includes("freeze") || log.action === "event_frozen" || log.action === "freeze_event") {
      activity.push({
        key: `audit-${log.id}`,
        icon: "🏁",
        label: "Event frozen",
        detail: null,
        timestamp: log.createdAt,
      });
    }
  }

  const recentActivity = activity
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 12);

  return {
    metrics,
    institutions,
    maxInstitutionTeams,
    audienceLeaderboard,
    aiLeaderboard,
    officialLeaderboard,
    recentActivity,
    breakdown: {
      draft: statusCounts.draft,
      submitted: statusCounts.submitted,
      finalized: statusCounts.finalized,
      prizeEligible,
      prizeIncomplete,
      students,
      others,
    },
    votingOpen: voting.open,
    resultsVisible: !!event.audienceResultsVisible,
    submissionsOpen: subStatus.open,
    winnersPublished: resultsPublished,
    updatedAt: now,
  };
}
