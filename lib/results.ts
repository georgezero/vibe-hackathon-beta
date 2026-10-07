import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  humanScores,
  judgeAssignments,
  judges,
  judgingAssignmentStates,
  judgingEvaluationStates,
  resultFinalists,
  resultPublicationStates,
  resultTieReviewSubmissions,
  resultTieReviews,
  resultWinners,
  publicationQualificationReleases,
  submissions,
  teamMembers,
} from "@/lib/db/schema";
import { isPublicationQualificationEnabled, isPublicationQualificationSubmission } from "@/lib/publication-qualification";
import type { InferSelectModel } from "drizzle-orm";

export const RESULT_RUBRIC_FIELDS = [
  ["problemSelection", "Problem selection"],
  ["productUsefulness", "Product usefulness"],
  ["functionality", "Functionality"],
  ["uxDesign", "UX design"],
  ["aiCollaboration", "AI collaboration"],
  ["originality", "Originality"],
  ["maintainability", "Maintainability"],
  ["presentationClarity", "Presentation clarity"],
] as const;

type Score = InferSelectModel<typeof humanScores>;
type Assignment = InferSelectModel<typeof judgeAssignments>;
type Submission = InferSelectModel<typeof submissions>;
type Judge = InferSelectModel<typeof judges>;
type Member = InferSelectModel<typeof teamMembers>;
type AssignmentState = InferSelectModel<typeof judgingAssignmentStates>;
type EvaluationState = InferSelectModel<typeof judgingEvaluationStates>;
type Finalist = InferSelectModel<typeof resultFinalists>;
type Winner = InferSelectModel<typeof resultWinners>;
type TieReview = InferSelectModel<typeof resultTieReviews>;
type TieMember = InferSelectModel<typeof resultTieReviewSubmissions>;
type Publication = InferSelectModel<typeof resultPublicationStates>;

export type ResultRow = {
  submissionId: string;
  projectTitle: string;
  teamName: string;
  institution: string;
  submissionState: string;
  rank: number | null;
  score: number | null;
  median: number | null;
  standardDeviation: number | null;
  high: number | null;
  low: number | null;
  completedReviews: number;
  requiredReviews: number;
  incomplete: boolean;
  tieKey: string | null;
  tieStatus: "none" | "pending" | "resolved";
  finalist: boolean;
  winner: string | null;
  published: boolean;
  category: string | null;
  needsReview: boolean;
};

export type ResultSummary = {
  eligibleSubmissions: number;
  rankedSubmissions: number;
  incompleteSubmissions: number;
  finalists: number;
  publishedResults: number;
  averageScore: number | null;
  medianScore: number | null;
  pendingTieReviews: number;
  judgesCompleted: number;
  totalJudges: number;
};

export type ResultsData = {
  event: { id: string; name: string; judgingDeadline: string | null } | null;
  summary: ResultSummary;
  rows: ResultRow[];
  ties: Array<{ tieKey: string; score: number; submissionIds: string[]; status: "pending" | "resolved"; rationale: string | null }>;
  finalists: Array<{ submissionId: string; reason: string | null }>;
  winners: Array<{ submissionId: string; category: string; awardLabel: string | null }>;
  publication: "calculated" | "reviewed" | "published";
};

export type ResultDetail = {
  row: ResultRow;
  evaluations: Array<{ judgeId: string; judgeName: string; score: number; submittedAt: string | null; criteria: Array<{ key: string; label: string; value: number | null }> }>;
  criterionBreakdown: Array<{ key: string; label: string; average: number | null; minimum: number | null; maximum: number | null; variance: number | null }>;
  rankingHistory: Array<{ label: string; createdAt: string }>;
};

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

function deviation(values: number[]) {
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return round(Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length));
}

function scoreValue(score: Score) {
  const values = RESULT_RUBRIC_FIELDS.map(([key]) => score[key]).filter((value): value is number => typeof value === "number");
  return values.length === RESULT_RUBRIC_FIELDS.length ? round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) : null;
}

function iso(value: Date | null | undefined) { return value ? value.toISOString() : null; }

export async function getResultsData(eventId: string): Promise<ResultsData> {
  const event = (await db.select({ id: events.id, name: events.name, judgingDeadline: events.judgingDeadline }).from(events).where(eq(events.id, eventId)).limit(1))[0] ?? null;
  const [allSubmissionRows, qualificationRows] = await Promise.all([
    db.select().from(submissions).where(eq(submissions.eventId, eventId)),
    db.select({ submissionId: publicationQualificationReleases.submissionId }).from(publicationQualificationReleases).where(eq(publicationQualificationReleases.eventId, eventId)),
  ]);
  const qualificationIds = new Set(qualificationRows.map((row: { submissionId: string }) => row.submissionId));
  const subRows: Submission[] = (allSubmissionRows as Submission[]).filter((row: Submission) => qualificationIds.has(row.id) ? (isPublicationQualificationEnabled() && isPublicationQualificationSubmission(row.id)) : !isPublicationQualificationEnabled());
  const ids = subRows.map((row: Submission) => row.id);
  const assignmentRows: Assignment[] = ids.length ? await db.select().from(judgeAssignments).where(inArray(judgeAssignments.submissionId, ids)) : [];
  const scoreRows: Score[] = ids.length ? await db.select().from(humanScores).where(inArray(humanScores.submissionId, ids)) : [];
  const judgeRows: Judge[] = await db.select().from(judges);
  const memberRows: Member[] = ids.length ? await db.select().from(teamMembers).where(inArray(teamMembers.submissionId, ids)) : [];
  const finalistRows: Finalist[] = await db.select().from(resultFinalists).where(and(eq(resultFinalists.eventId, eventId), eq(resultFinalists.status, "active")));
  const winnerRows: Winner[] = await db.select().from(resultWinners).where(and(eq(resultWinners.eventId, eventId), eq(resultWinners.status, "active")));
  const tieRows: TieReview[] = await db.select().from(resultTieReviews).where(eq(resultTieReviews.eventId, eventId));
  const tieMemberRows: TieMember[] = await db.select().from(resultTieReviewSubmissions);
  const publicationRows: Publication[] = await db.select().from(resultPublicationStates).where(eq(resultPublicationStates.eventId, eventId)).limit(1);

  const assignmentIds = assignmentRows.map((row) => row.id);
  const assignmentStateRows: AssignmentState[] = assignmentIds.length ? await db.select().from(judgingAssignmentStates).where(inArray(judgingAssignmentStates.assignmentId, assignmentIds)) : [];
  const evaluationStateRows: EvaluationState[] = assignmentIds.length ? await db.select().from(judgingEvaluationStates).where(inArray(judgingEvaluationStates.assignmentId, assignmentIds)) : [];
  const assignmentState = new Map(assignmentStateRows.map((row) => [row.assignmentId, row]));
  const evaluationState = new Map(evaluationStateRows.map((row) => [row.assignmentId, row]));
  const memberBySubmission = new Map<string, string>();
  for (const member of memberRows) if (!memberBySubmission.has(member.submissionId)) memberBySubmission.set(member.submissionId, member.affiliation?.trim() || "Institution not listed");
  const scoreByKey = new Map(scoreRows.map((score) => [`${score.judgeId}:${score.submissionId}`, score]));
  const assignmentsBySubmission = new Map<string, Assignment[]>();
  for (const assignment of assignmentRows) {
    const state = assignmentState.get(assignment.id);
    if (state?.status === "removed" || state?.status === "superseded" || state?.conflictStatus !== "clear") continue;
    const list = assignmentsBySubmission.get(assignment.submissionId) ?? [];
    list.push(assignment);
    assignmentsBySubmission.set(assignment.submissionId, list);
  }

  const completedBySubmission = new Map<string, number[]>();
  const scoresBySubmission = new Map<string, Array<{ score: Score; value: number }>>();
  for (const submission of subRows) {
    const rows = assignmentsBySubmission.get(submission.id) ?? [];
    for (const assignment of rows) {
      const evaluation = evaluationState.get(assignment.id)?.status;
      const score = scoreByKey.get(`${assignment.judgeId}:${assignment.submissionId}`);
      const value = score ? scoreValue(score) : null;
      const completed = evaluation === "submitted" || evaluation === "frozen" || (!evaluation && score?.completed === true);
      if (completed && score && value !== null) {
        const list = scoresBySubmission.get(submission.id) ?? [];
        list.push({ score, value });
        scoresBySubmission.set(submission.id, list);
        const values = completedBySubmission.get(submission.id) ?? [];
        values.push(value);
        completedBySubmission.set(submission.id, values);
      }
    }
  }

  const finalistSet = new Set(finalistRows.map((row) => row.submissionId));
  const winnerBySubmission = new Map(winnerRows.map((row) => [row.submissionId, row.category === "custom" ? row.awardLabel || "Custom award" : row.category.replaceAll("_", " ")]));
  const tieMembersByReview = new Map(tieRows.map((review) => [review.tieKey, tieMemberRows.filter((member) => member.tieReviewId === review.id).map((member) => member.submissionId)]));
  const tieStatusBySubmission = new Map<string, { tieKey: string; status: "pending" | "resolved" }>();
  for (const review of tieRows) for (const submissionId of tieMembersByReview.get(review.tieKey) ?? []) tieStatusBySubmission.set(submissionId, { tieKey: review.tieKey, status: review.status });

  const provisional: Array<{ submission: Submission; scores: number[]; required: number; complete: boolean }> = subRows.map((submission: Submission) => {
    const scores = completedBySubmission.get(submission.id) ?? [];
    const required = (assignmentsBySubmission.get(submission.id) ?? []).length;
    const complete = required > 0 && scores.length === required;
    return { submission, scores, required, complete };
  });
  const ranked = provisional.filter((row: { complete: boolean }) => row.complete).sort((a: { scores: number[] }, b: { scores: number[] }) => (b.scores.reduce((x: number, y: number) => x + y, 0) / b.scores.length) - (a.scores.reduce((x: number, y: number) => x + y, 0) / a.scores.length));
  const rankBySubmission = new Map<string, number>();
  let previousScore: number | null = null;
  let previousRank = 0;
  ranked.forEach((item: { submission: Submission; scores: number[] }, index: number) => {
    const current = round(item.scores.reduce((x: number, y: number) => x + y, 0) / item.scores.length);
    if (previousScore === null || current !== previousScore) previousRank = index + 1;
    rankBySubmission.set(item.submission.id, previousRank);
    previousScore = current;
  });

  const rows: ResultRow[] = provisional.map(({ submission, scores, required, complete }: { submission: Submission; scores: number[]; required: number; complete: boolean }) => {
    const values = scores;
    const tie = tieStatusBySubmission.get(submission.id);
    const tieGroup = ranked.filter((item: { complete: boolean; scores: number[] }) => {
      const left = item.scores.reduce((x: number, y: number) => x + y, 0) / item.scores.length;
      const right = scores.reduce((x: number, y: number) => x + y, 0) / (scores.length || 1);
      return scores.length > 0 && item.complete && round(left) === round(right);
    });
    const tieKey = tie?.tieKey ?? (tieGroup.length > 1 ? `score-${round(scores.reduce((x: number, y: number) => x + y, 0) / (scores.length || 1))}` : null);
    const tieStatus: ResultRow["tieStatus"] = tie?.status ?? (tieGroup.length > 1 ? "pending" : "none");
    return {
      submissionId: submission.id,
      projectTitle: submission.projectTitle || "Untitled project",
      teamName: submission.teamName,
      institution: memberBySubmission.get(submission.id) || "Institution not listed",
      submissionState: submission.status,
      rank: complete ? rankBySubmission.get(submission.id) ?? null : null,
      score: complete && values.length ? round(values.reduce((x, y) => x + y, 0) / values.length) : null,
      median: complete ? median(values) : null,
      standardDeviation: complete ? deviation(values) : null,
      high: complete ? Math.max(...values) : null,
      low: complete ? Math.min(...values) : null,
      completedReviews: scores.length,
      requiredReviews: required,
      incomplete: !complete,
      tieKey,
      tieStatus,
      finalist: finalistSet.has(submission.id),
      winner: winnerBySubmission.get(submission.id) ?? null,
      published: publicationRows[0]?.status === "published" && Boolean(winnerBySubmission.has(submission.id)),
      category: winnerBySubmission.get(submission.id) ?? null,
      needsReview: !complete || Boolean(tieKey && tie?.status !== "resolved"),
    };
  }).sort((a: ResultRow, b: ResultRow) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.projectTitle.localeCompare(b.projectTitle));

  const ties = [...new Set(rows.filter((row) => row.tieKey).map((row) => row.tieKey as string))].map((tieKey) => {
    const members = rows.filter((row) => row.tieKey === tieKey);
    const existing = tieRows.find((row) => row.tieKey === tieKey);
    return { tieKey, score: members[0]?.score ?? 0, submissionIds: members.map((row) => row.submissionId), status: existing?.status ?? "pending", rationale: existing?.rationale ?? null };
  });
  const allRankedScores = rows.filter((row) => row.score !== null).map((row) => row.score as number);
  return {
    event: event ? { id: event.id, name: event.name, judgingDeadline: iso(event.judgingDeadline) } : null,
    summary: {
      eligibleSubmissions: subRows.length,
      rankedSubmissions: rows.filter((row) => !row.incomplete).length,
      incompleteSubmissions: rows.filter((row) => row.incomplete).length,
      finalists: finalistRows.length,
      publishedResults: publicationRows[0]?.status === "published" ? winnerRows.length : 0,
      averageScore: allRankedScores.length ? round(allRankedScores.reduce((sum, value) => sum + value, 0) / allRankedScores.length) : null,
      medianScore: median(allRankedScores),
      pendingTieReviews: ties.filter((tie) => tie.status === "pending").length,
      judgesCompleted: new Set(rows.flatMap((row) => (scoresBySubmission.get(row.submissionId) ?? []).map((item) => item.score.judgeId))).size,
      totalJudges: judgeRows.length,
    },
    rows,
    ties,
    finalists: finalistRows.map((row) => ({ submissionId: row.submissionId, reason: row.reason })),
    winners: winnerRows.map((row) => ({ submissionId: row.submissionId, category: row.category, awardLabel: row.awardLabel })),
    publication: publicationRows[0]?.status ?? "calculated",
  };
}

export async function getResultDetail(eventId: string, submissionId: string): Promise<ResultDetail | null> {
  const data = await getResultsData(eventId);
  const row = data.rows.find((item) => item.submissionId === submissionId);
  if (!row) return null;
  const scoreRows: Score[] = await db.select().from(humanScores).where(eq(humanScores.submissionId, submissionId));
  const assignments: Assignment[] = await db.select().from(judgeAssignments).where(eq(judgeAssignments.submissionId, submissionId));
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const assignmentStates: AssignmentState[] = assignmentIds.length ? await db.select().from(judgingAssignmentStates).where(inArray(judgingAssignmentStates.assignmentId, assignmentIds)) : [];
  const evaluationStates: EvaluationState[] = assignmentIds.length ? await db.select().from(judgingEvaluationStates).where(inArray(judgingEvaluationStates.assignmentId, assignmentIds)) : [];
  const assignmentStateById = new Map(assignmentStates.map((state) => [state.assignmentId, state]));
  const evaluationStateById = new Map(evaluationStates.map((state) => [state.assignmentId, state]));
  const eligibleJudgeIds = new Set(assignments.filter((assignment) => {
    const state = assignmentStateById.get(assignment.id);
    const evaluation = evaluationStateById.get(assignment.id)?.status;
    return state?.status !== "removed" && state?.status !== "superseded" && state?.conflictStatus === "clear" && (evaluation === "submitted" || evaluation === "frozen");
  }).map((assignment) => assignment.judgeId));
  const judgeRows: Judge[] = await db.select().from(judges);
  const judgeMap = new Map(judgeRows.map((judge: Judge) => [judge.id, judge.name]));
  const evaluations = scoreRows.filter((score: Score) => score.completed && eligibleJudgeIds.has(score.judgeId)).map((score: Score) => ({
    judgeId: score.judgeId,
    judgeName: judgeMap.get(score.judgeId) ?? "Judge",
    score: scoreValue(score) ?? 0,
    submittedAt: iso(score.updatedAt),
    criteria: RESULT_RUBRIC_FIELDS.map(([key, label]) => ({ key, label, value: score[key] })),
  }));
  const criterionBreakdown = RESULT_RUBRIC_FIELDS.map(([key, label]) => {
    const values = evaluations.map((evaluation: { criteria: Array<{ key: string; value: number | null }> }) => evaluation.criteria.find((criterion: { key: string; value: number | null }) => criterion.key === key)?.value).filter((value): value is number => typeof value === "number");
    return { key, label, average: values.length ? round(values.reduce((sum: number, value: number) => sum + value, 0) / values.length, 1) : null, minimum: values.length ? Math.min(...values) : null, maximum: values.length ? Math.max(...values) : null, variance: deviation(values) };
  });
  return { row, evaluations, criterionBreakdown, rankingHistory: [{ label: row.rank ? `Calculated rank ${row.rank}` : "Awaiting complete evaluations", createdAt: new Date().toISOString() }] };
}
