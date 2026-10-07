export const dynamic = "force-dynamic";

import { NavPublic } from "@/components/NavPublic";
import { EventFreezeBanner } from "@/components/EventFreezeBanner";
import { db } from "@/lib/db";
import {
  submissions,
  judges,
  judgeAssignments,
  humanScores,
  aiReviews,
  aiJudgeRuns,
  audienceVotes,
  audienceVoters,
  teamMembers,
  teamOwners,
} from "@/lib/db/schema";
import { eq, inArray, sql, count, type InferSelectModel } from "drizzle-orm";
import { getRankingData } from "@/lib/rankings";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import { computeSubmissionReadiness } from "@/lib/submission-readiness";
import { toAdminTeamMembers, rosterSummary, type AdminTeamRoster } from "@/lib/team-display";
import { getBaseUrl } from "@/lib/base-url";
import { getPresentationEligibilityRows } from "@/lib/presentation-data";
import { requireAdminSession } from "@/lib/admin-session";
import {
  getActiveEvent,
  getAllEvents,
  submissionDeadlineStatus,
  judgingDeadlineStatus,
  type EventRow,
} from "@/lib/events";
import AdminDashboardClient, {
  type AdminPageData,
  type SubmissionRow,
  type JudgeRow,
  type AnalyticsData,
  type HarnessCount,
  type ModelCount,
  type BudgetCount,
  type AllEventRow,
  type AiJudgeRunRow,
  type SubmissionReadinessRow,
} from "../AdminDashboardClient";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { headers } from "next/headers";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { getEventHealthData } from "@/lib/event-health";

type Sub = InferSelectModel<typeof submissions>;
type JudgeModel = Pick<InferSelectModel<typeof judges>, "id" | "name" | "email">;
type TeamOwnerModel = InferSelectModel<typeof teamOwners>;
type TeamMemberModel = InferSelectModel<typeof teamMembers>;
type HumanScoreModel = InferSelectModel<typeof humanScores>;
type VoteCountRow = { submissionId: string; count: number };
type ReviewRow = {
  submissionId: string;
  status: "pending" | "running" | "complete";
  generatedScore: number | null;
  complianceCheck: "pass" | "partial" | "fail" | "pending" | null;
  generatedRationale: string | null;
};
type JudgeCountRow = { judgeId: string; count: number };
type TeamMemberCountRow = { submissionId: string; count: number };

const URL_TO_TAB: Record<string, string> = {
  overview: "overview",
  submissions: "submissions",
  rankings: "rankings",
  judges: "judges",
  "ai-reviews": "ai",
  "audience-votes": "votes",
  analytics: "analytics",
  export: "export",
  "demo-checklist": "checklist",
  "release-checklist": "release",
  "submission-readiness": "readiness",
  winners: "winners",
  "event-settings": "event-settings",
  presentation: "presentation",
};

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ tab?: string[] }>;
}) {
  const adminSession = await requireAdminSession();
  const { tab: tabSegments } = await params;
  const urlSlug = tabSegments?.[0] ?? "overview";
  const initialTab = URL_TO_TAB[urlSlug] ?? "overview";

  // ── All submissions ─────────────────────────────────────────────────────────
  const subRows: Sub[] = await db.select().from(submissions);
  const subIds = subRows.map((s: Sub) => s.id);

  // ── Vote counts per submission ──────────────────────────────────────────────
  let voteCounts: Record<string, number> = {};
  if (subIds.length > 0) {
    const voteRows: VoteCountRow[] = await db
      .select({
        submissionId: audienceVotes.submissionId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(audienceVotes)
      .where(inArray(audienceVotes.submissionId, subIds))
      .groupBy(audienceVotes.submissionId);
    voteCounts = Object.fromEntries(
      voteRows.map((v: VoteCountRow) => [v.submissionId, v.count])
    );
  }

  // ── AI reviews ──────────────────────────────────────────────────────────────
  type ReviewMapEntry = {
    status: string;
    generatedScore: number | null;
    complianceCheck: string | null;
    generatedRationale: string | null;
  };
  const reviewMap: Record<string, ReviewMapEntry> = {};
  if (subIds.length > 0) {
    const reviewRows: ReviewRow[] = await db
      .select({
        submissionId: aiReviews.submissionId,
        status: aiReviews.status,
        generatedScore: aiReviews.generatedScore,
        complianceCheck: aiReviews.complianceCheck,
        generatedRationale: aiReviews.generatedRationale,
      })
      .from(aiReviews)
      .where(inArray(aiReviews.submissionId, subIds));
    for (const r of reviewRows) {
      reviewMap[r.submissionId] = {
        status: r.status,
        generatedScore: r.generatedScore,
        complianceCheck: r.complianceCheck ?? null,
        generatedRationale: r.generatedRationale,
      };
    }
  }

  // ── Human scores — compute avg per submission ───────────────────────────────
  const avgScoreMap: Record<string, number> = {};
  if (subIds.length > 0) {
    const scoreRows: HumanScoreModel[] = await db
      .select()
      .from(humanScores)
      .where(inArray(humanScores.submissionId, subIds));

    const completedBySubmission: Record<string, number[]> = {};
    for (const score of scoreRows) {
      if (!score.completed) continue;
      const fields = [
        score.problemSelection,
        score.productUsefulness,
        score.functionality,
        score.uxDesign,
        score.aiCollaboration,
        score.originality,
        score.maintainability,
        score.presentationClarity,
      ].filter((v): v is number => v !== null && v !== undefined);
      if (fields.length === 0) continue;
      const avg = fields.reduce((a, b) => a + b, 0) / fields.length;
      if (!completedBySubmission[score.submissionId]) {
        completedBySubmission[score.submissionId] = [];
      }
      completedBySubmission[score.submissionId].push(avg);
    }

    for (const [subId, avgs] of Object.entries(completedBySubmission)) {
      const overall = avgs.reduce((a, b) => a + b, 0) / avgs.length;
      avgScoreMap[subId] = Math.round(overall * 10) / 10;
    }
  }

  // ── Judges ──────────────────────────────────────────────────────────────────
  const judgeRows: JudgeModel[] = await db.select({
    id: judges.id,
    name: judges.name,
    email: judges.email,
  }).from(judges);
  const judgeIds = judgeRows.map((j: JudgeModel) => j.id);

  let assignedCounts: Record<string, number> = {};
  let completedCounts: Record<string, number> = {};

  if (judgeIds.length > 0) {
    const assignRows: JudgeCountRow[] = await db
      .select({
        judgeId: judgeAssignments.judgeId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(judgeAssignments)
      .where(inArray(judgeAssignments.judgeId, judgeIds))
      .groupBy(judgeAssignments.judgeId);
    assignedCounts = Object.fromEntries(
      assignRows.map((r: JudgeCountRow) => [r.judgeId, r.count])
    );

    const completedRows: JudgeCountRow[] = await db
      .select({
        judgeId: humanScores.judgeId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(humanScores)
      .where(eq(humanScores.completed, true))
      .groupBy(humanScores.judgeId);
    completedCounts = Object.fromEntries(
      completedRows.map((r: JudgeCountRow) => [r.judgeId, r.count])
    );
  }

  // ── Analytics ────────────────────────────────────────────────────────────────
  const BUDGET_LABELS: Record<string, string> = {
    free_trial_only: "Free trial",
    standard_subscription: "Paid subscription",
    multiple_paid_subscriptions: "Multiple subscriptions",
    api_under_10: "API < $10",
    api_10_to_50: "API $10–$50",
    api_50_to_200: "API $50–$200",
    api_over_200: "API > $200",
    local_models_only: "Local models",
    unknown: "Unknown",
  };

  const harnessMap: Record<string, number> = {};
  const modelMap: Record<string, number> = {};
  const budgetMap: Record<string, number> = {};
  let totalHuman = 0;
  let totalAgent = 0;
  let humanCount = 0;
  let agentCount = 0;
  let vibeJsonCount = 0;
  let budgetDataCount = 0;

  for (const s of subRows) {
    const harnesses = s.agentHarnesses as string[] | null;
    const models = s.agentModels as string[] | null;
    if (harnesses) {
      for (const h of harnesses) { harnessMap[h] = (harnessMap[h] ?? 0) + 1; }
    }
    if (models) {
      for (const m of models) { modelMap[m] = (modelMap[m] ?? 0) + 1; }
    }
    if (s.budgetTier) {
      budgetMap[s.budgetTier] = (budgetMap[s.budgetTier] ?? 0) + 1;
      budgetDataCount++;
    }
    if (s.estimatedHumanHours !== null && s.estimatedHumanHours !== undefined) {
      totalHuman += s.estimatedHumanHours;
      humanCount++;
    }
    if (s.estimatedAgentHours !== null && s.estimatedAgentHours !== undefined) {
      totalAgent += s.estimatedAgentHours;
      agentCount++;
    }
    if (s.vibeJsonRaw) vibeJsonCount++;
  }

  const totalHarnesses = Object.values(harnessMap).reduce((a, b) => a + b, 0);
  const totalModels = Object.values(modelMap).reduce((a, b) => a + b, 0);

  const analyticsData: AnalyticsData = {
    harnesses: Object.entries(harnessMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]): HarnessCount => ({ name, count, pct: Math.round((count / Math.max(totalHarnesses, 1)) * 100) })),
    models: Object.entries(modelMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]): ModelCount => ({ name, count, pct: Math.round((count / Math.max(totalModels, 1)) * 100) })),
    budgetTiers: Object.entries(budgetMap)
      .sort((a, b) => b[1] - a[1])
      .map(([tier, count]): BudgetCount => ({ tier, label: BUDGET_LABELS[tier] ?? tier, count, pct: Math.round((count / Math.max(budgetDataCount, 1)) * 100) })),
    avgHumanHours: humanCount > 0 ? Math.round((totalHuman / humanCount) * 10) / 10 : null,
    avgAgentHours: agentCount > 0 ? Math.round((totalAgent / agentCount) * 10) / 10 : null,
    totalHumanHours: totalHuman,
    totalAgentHours: totalAgent,
    submissionsWithVibeJson: vibeJsonCount,
    submissionsWithBudgetData: budgetDataCount,
    totalSubmissions: subRows.length,
  };

  let teamSizeMap: Record<string, number> = {};
  const badgeCountMap: Record<string, number> = {};
  const prizeEligibleMap: Record<string, boolean> = {};
  const traineeCountMap: Record<string, number> = {};
  let readinessRows: SubmissionReadinessRow[] = [];
  let teamRosterRows: AdminTeamRoster[] = [];
  const ownerMap: Record<string, { githubLogin: string | null; ownerBadgePresent: boolean; badgeVerificationStatus: string; ownershipType: "github" | "badge" }> = {};
  if (subIds.length > 0) {
    const memberCounts: TeamMemberCountRow[] = await db
      .select({ submissionId: teamMembers.submissionId, count: sql<number>`cast(count(*) as integer)` })
      .from(teamMembers)
      .where(inArray(teamMembers.submissionId, subIds))
      .groupBy(teamMembers.submissionId);
    teamSizeMap = Object.fromEntries(memberCounts.map((row) => [row.submissionId, row.count]));

    const teamIds = subRows.map((s) => s.teamId).filter((id): id is string => Boolean(id));
    if (teamIds.length > 0) {
      const ownerRows: TeamOwnerModel[] = await db.select().from(teamOwners).where(inArray(teamOwners.teamId, teamIds));
      const byTeam: Record<string, { githubLogin: string | null; ownerBadgePresent: boolean; badgeVerificationStatus: string; ownershipType: "github" | "badge" }> = Object.fromEntries(ownerRows.map((owner: TeamOwnerModel) => [owner.teamId, {
        githubLogin: owner.githubLogin,
        ownerBadgePresent: Boolean(owner.ownerBadgeNumber),
        badgeVerificationStatus: owner.badgeVerificationStatus,
        ownershipType: "github",
      }]));
      for (const s of subRows) {
        if (s.teamId && byTeam[s.teamId]) ownerMap[s.id] = byTeam[s.teamId];
      }
    }

    const ownerMembers: TeamMemberModel[] = await db.select().from(teamMembers).where(inArray(teamMembers.submissionId, subIds));
    const membersBySubmission: Record<string, TeamMemberModel[]> = {};
    for (const member of ownerMembers) {
      if (!membersBySubmission[member.submissionId]) membersBySubmission[member.submissionId] = [];
      membersBySubmission[member.submissionId].push(member);
      if (member.isStudentTrainee) {
        traineeCountMap[member.submissionId] = (traineeCountMap[member.submissionId] ?? 0) + 1;
      }
      if (member.order === 0 && !ownerMap[member.submissionId]) {
        ownerMap[member.submissionId] = {
          githubLogin: null,
          ownerBadgePresent: Boolean(member.badgeNumber),
          badgeVerificationStatus: member.badgeVerificationStatus,
          ownershipType: "badge",
        };
      }
    }
    for (const [submissionId, members] of Object.entries(membersBySubmission)) {
      const summary = computePrizeEligibility(members.map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));
      badgeCountMap[submissionId] = summary.badgeCount;
      prizeEligibleMap[submissionId] = summary.eligibleForPrize;
    }
    teamRosterRows = subRows.map((s: Sub) => {
      const members = membersBySubmission[s.id] ?? [];
      const summary = rosterSummary(members);
      return {
        submissionId: s.id,
        teamName: s.teamName,
        projectTitle: s.projectTitle,
        ownershipType: ownerMap[s.id]?.ownershipType ?? "badge",
        ownerGithubLogin: ownerMap[s.id]?.githubLogin ?? null,
        teamSize: summary.memberCount,
        badgeCount: summary.badgeCount,
        prizeEligible: summary.eligibleForPrize,
        studentTraineeCount: summary.studentTraineeCount,
        members: toAdminTeamMembers(members),
      };
    });
    readinessRows = subRows.map((s: Sub) => {
      const members = membersBySubmission[s.id] ?? [];
      const readiness = computeSubmissionReadiness(s, members.map((member) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));
      return {
        id: s.id,
        editToken: s.editToken,
        projectTitle: s.projectTitle,
        teamName: s.teamName,
        contactEmail: s.contactEmail,
        status: s.status,
        completeCount: readiness.completeCount,
        totalCount: readiness.totalCount,
        completionPercent: readiness.completionPercent,
        readinessStatus: readiness.status,
        teamEligible: readiness.teamEligibility.eligibleForPrize,
        badgeCount: readiness.teamEligibility.badgeCount,
        memberCount: readiness.teamEligibility.memberCount,
        studentTraineeCount: readiness.teamEligibility.studentTraineeCount,
        missingItems: readiness.missingItems.map((item) => ({ key: item.key, label: item.label })),
        updatedAt: (s.finalizedAt ?? s.submittedAt ?? s.createdAt)?.toISOString() ?? null,
      };
    });
  } else {
    readinessRows = subRows.map((s: Sub) => {
      const readiness = computeSubmissionReadiness(s, []);
      return {
        id: s.id,
        editToken: s.editToken,
        projectTitle: s.projectTitle,
        teamName: s.teamName,
        contactEmail: s.contactEmail,
        status: s.status,
        completeCount: readiness.completeCount,
        totalCount: readiness.totalCount,
        completionPercent: readiness.completionPercent,
        readinessStatus: readiness.status,
        teamEligible: readiness.teamEligibility.eligibleForPrize,
        badgeCount: readiness.teamEligibility.badgeCount,
        memberCount: readiness.teamEligibility.memberCount,
        studentTraineeCount: readiness.teamEligibility.studentTraineeCount,
        missingItems: readiness.missingItems.map((item) => ({ key: item.key, label: item.label })),
        updatedAt: (s.finalizedAt ?? s.submittedAt ?? s.createdAt)?.toISOString() ?? null,
      };
    });
  }

  // ── Assemble page data ──────────────────────────────────────────────────────
  const submissionData: SubmissionRow[] = subRows.map((s: Sub) => ({
    id: s.id,
    editToken: s.editToken,
    status: s.status,
    teamName: s.teamName,
    contactEmail: s.contactEmail,
    projectTitle: s.projectTitle,
    demoUrl: s.demoUrl,
    voteCount: voteCounts[s.id] ?? 0,
    aiReviewStatus: reviewMap[s.id]?.status ?? null,
    aiGeneratedScore: reviewMap[s.id]?.generatedScore ?? null,
    aiComplianceCheck: reviewMap[s.id]?.complianceCheck ?? null,
    aiGeneratedRationale: reviewMap[s.id]?.generatedRationale ?? null,
    avgHumanScore: avgScoreMap[s.id] ?? null,
    ownerGithubLogin: ownerMap[s.id]?.githubLogin ?? null,
    ownershipType: ownerMap[s.id]?.ownershipType ?? "badge",
    teamSize: teamSizeMap[s.id] ?? 0,
    badgeCount: badgeCountMap[s.id] ?? 0,
    prizeEligible: prizeEligibleMap[s.id] ?? false,
    studentTraineeCount: traineeCountMap[s.id] ?? 0,
    ownerBadgePresent: ownerMap[s.id]?.ownerBadgePresent ?? false,
    badgeVerificationStatus: ownerMap[s.id]?.badgeVerificationStatus ?? "unknown",
  }));

  const judgeData: JudgeRow[] = judgeRows.map((j: JudgeModel) => ({
    id: j.id,
    name: j.name,
    email: j.email,
    assignedCount: assignedCounts[j.id] ?? 0,
    completedCount: completedCounts[j.id] ?? 0,
  }));

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const finalizedCount = subRows.filter(
    (s: Sub) => s.status === "finalized" || s.status === "locked"
  ).length;
  const completedScoresCount = Object.values(completedCounts).reduce((a, b) => a + b, 0);
  const completedAiReviews = Object.values(reviewMap).filter(
    (r: ReviewMapEntry) => r.status === "complete"
  ).length;
  type JudgeRunModel = InferSelectModel<typeof aiJudgeRuns>;
  const [rankingData, activeEvent, allEventsRaw, allJudgeRuns, voterCountRows, emailCountRows, presentationEligibility] = await Promise.all([
    getRankingData(),
    getActiveEvent(),
    getAllEvents(),
    subIds.length > 0
      ? db.select().from(aiJudgeRuns).where(inArray(aiJudgeRuns.submissionId, subIds))
      : (Promise.resolve([]) as Promise<InferSelectModel<typeof aiJudgeRuns>[]>),
    db.select({ total: count() }).from(audienceVoters),
    db.select({ total: count() }).from(audienceVoters).where(sql`email_hash IS NOT NULL`),
    getPresentationEligibilityRows(),
  ]);

  const subDeadlineStatus = submissionDeadlineStatus(activeEvent);
  const judgeDeadlineStatus = judgingDeadlineStatus(activeEvent);
  const eventHealth = await getEventHealthData(activeEvent.id);
  const applicationResolution = await resolveApplicationPrincipal(
    await headers(),
    { eventId: activeEvent.id },
  );
  const headerRoles = applicationResolution.status === "authenticated"
    ? applicationResolution.principal.roles
    : { isAdmin: true, isJudge: false };

  function serializeEvent(ev: EventRow) {
    return {
      id: ev.id,
      name: ev.name,
      displayName: ev.displayName ?? null,
      logoUrl: ev.logoUrl ?? null,
      tagline: ev.tagline ?? null,
      externalUrl: ev.externalUrl ?? null,
      slug: ev.slug ?? ev.id,
      isActive: !!ev.isActive,
      audienceVotingEnabled: !!ev.audienceVotingEnabled,
      audienceAwardCount: ev.audienceAwardCount ?? 1,
      audienceVotesPerPerson: ev.audienceVotesPerPerson ?? 1,
      audienceVotingStartsAt: ev.audienceVotingStartsAt?.toISOString() ?? null,
      audienceVotingEndsAt: ev.audienceVotingEndsAt?.toISOString() ?? null,
      audienceResultsVisible: !!ev.audienceResultsVisible,
      audienceVotingMode: (ev as EventRow & { audienceVotingMode?: string }).audienceVotingMode ?? "disabled",
      audienceIdentityMethod: (ev as EventRow & { audienceIdentityMethod?: string }).audienceIdentityMethod ?? "anonymous",
      submissionDeadline: ev.submissionDeadline?.toISOString() ?? null,
      judgingDeadline: ev.judgingDeadline?.toISOString() ?? null,
      winnersPublishedAt: ev.winnersPublishedAt?.toISOString() ?? null,
      isFrozen: Boolean(ev.isFrozen),
      showJudgeChoice: (ev as EventRow & { showJudgeChoice?: boolean }).showJudgeChoice !== false,
      showPeoplesChoice: (ev as EventRow & { showPeoplesChoice?: boolean }).showPeoplesChoice !== false,
      showAIChoice: (ev as EventRow & { showAIChoice?: boolean }).showAIChoice !== false,
      showSpecialAwards: (ev as EventRow & { showSpecialAwards?: boolean }).showSpecialAwards !== false,
    };
  }

  const allEventsForSelector: AllEventRow[] = allEventsRaw.map((ev: EventRow) => ({
    id: ev.id,
    name: ev.name,
    displayName: ev.displayName ?? null,
    isActive: !!ev.isActive,
    winnersPublishedAt: ev.winnersPublishedAt?.toISOString() ?? null,
  }));

  const aiJudgeRunData: AiJudgeRunRow[] = (allJudgeRuns as JudgeRunModel[]).map((r) => ({
    id: r.id,
    submissionId: r.submissionId,
    modelProvider: r.modelProvider,
    modelName: r.modelName,
    status: r.status as AiJudgeRunRow["status"],
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    error: r.error ?? null,
    rationale: r.rationale ?? null,
    scoresJson: (r.scoresJson as Record<string, unknown> | null) ?? null,
    createdAt: r.createdAt?.toISOString() ?? null,
  }));

  const pageData: AdminPageData = {
    submissions: submissionData,
    judges: judgeData,
    totalVotes,
    finalizedCount,
    completedScoresCount,
    completedAiReviews,
    analytics: analyticsData,
    rankings: rankingData.rankings,
    peoplesChoiceRankings: rankingData.peoplesChoiceRankings,
    judgeCalibration: rankingData.judgeCalibration,
    activeEvent: serializeEvent(activeEvent),
    allEvents: allEventsForSelector,
    submissionDeadlineStatus: subDeadlineStatus,
    judgingDeadlineStatus: judgeDeadlineStatus,
    aiJudgeRuns: aiJudgeRunData,
    submissionReadiness: readinessRows,
    teamRosters: teamRosterRows,
    baseUrl: getBaseUrl(),
    baseUrlConfigured: !!process.env.VIBE_HACKATHON_BASE_URL,
    audienceVoterCount: voterCountRows[0]?.total ?? 0,
    audienceEmailCaptureCount: emailCountRows[0]?.total ?? 0,
    presentationEligibility,
    eventHealth,
    initialTab,
    adminSession,
  };

  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic variant="admin" authenticatedAccount={applicationHeaderAccount({
        ...adminSession,
        roles: headerRoles,
      })} />
      <EventFreezeBanner admin />
      <AdminDashboardClient data={pageData} />
    </div>
  );
}
