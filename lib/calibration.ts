import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { getResultsData } from "@/lib/results";
import { RESULT_RUBRIC_FIELDS } from "@/lib/results";
import {
  calibrationConsensusReviews,
  calibrationThresholds,
  events,
  humanScores,
  judgeAssignments,
  judges,
  judgingAssignmentStates,
  judgingEvaluationStates,
  resultFinalists,
  submissions,
  teamMembers,
} from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

type Score = InferSelectModel<typeof humanScores>;
type Assignment = InferSelectModel<typeof judgeAssignments>;
type AssignmentState = InferSelectModel<typeof judgingAssignmentStates>;
type EvaluationState = InferSelectModel<typeof judgingEvaluationStates>;
type Judge = InferSelectModel<typeof judges>;
type Submission = InferSelectModel<typeof submissions>;
type Member = InferSelectModel<typeof teamMembers>;
type Consensus = InferSelectModel<typeof calibrationConsensusReviews>;

export const DEFAULT_CALIBRATION_THRESHOLDS = { overallVariance: 64, criterionVariance: 4, outlierDifference: 20, minimumEvaluations: 2 } as const;

export type CalibrationThresholds = { overallVariance: number; criterionVariance: number; outlierDifference: number; minimumEvaluations: number };

export function roundValue(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function populationVariance(values: number[]) {
  if (!values.length) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return roundValue(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

export function medianValue(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return roundValue(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

export function scoreFromRow(score: Score) {
  const values = RESULT_RUBRIC_FIELDS.map(([key]) => score[key]).filter((value): value is number => typeof value === "number");
  return values.length === RESULT_RUBRIC_FIELDS.length ? roundValue(values.reduce((sum, value) => sum + value, 0) / values.length * 10) : null;
}

export function classifyCalibrationStatus(input: { completed: number; averageDeviation: number | null; averageScore: number | null; panelAverage: number | null; outlierCount: number; minimumEvaluations?: number }) {
  const minimum = input.minimumEvaluations ?? DEFAULT_CALIBRATION_THRESHOLDS.minimumEvaluations;
  if (input.completed < minimum) return "Insufficient data" as const;
  if (input.outlierCount > 0 || (input.averageDeviation ?? 0) >= DEFAULT_CALIBRATION_THRESHOLDS.outlierDifference) return "Needs review" as const;
  const delta = input.averageScore !== null && input.panelAverage !== null ? input.averageScore - input.panelAverage : 0;
  if (delta >= 8) return "Slightly lenient" as const;
  if (delta <= -8) return "Slightly strict" as const;
  return "Well calibrated" as const;
}

type EvaluationRecord = { assignment: Assignment; judge: Judge; score: Score; value: number; criteria: Array<{ key: string; label: string; value: number }> };

export type CalibrationSubmissionRow = {
  submissionId: string;
  projectTitle: string;
  teamName: string;
  institution: string;
  rank: number | null;
  average: number | null;
  median: number | null;
  variance: number | null;
  standardDeviation: number | null;
  spread: number | null;
  high: number | null;
  low: number | null;
  completed: number;
  required: number;
  criterionVariance: number | null;
  consensusStatus: "not_required" | "suggested" | "in_review" | "complete" | "flagged";
  finalist: boolean;
  tie: boolean;
  needsReview: boolean;
  readyForAward: boolean;
  outlierCount: number;
};

export type CalibrationJudgeRow = {
  id: string;
  name: string;
  institution: string;
  completed: number;
  average: number | null;
  median: number | null;
  standardDeviation: number | null;
  averageDeviation: number | null;
  highestDisagreement: number | null;
  lowestDisagreement: number | null;
  status: ReturnType<typeof classifyCalibrationStatus>;
  needsReview: boolean;
};

export type CalibrationOutlier = { submissionId: string; projectTitle: string; judgeId: string; judgeName: string; criterion: string; difference: number; overallDeviation: number; reason: "Statistical outlier" };

export type CalibrationData = {
  event: { id: string; name: string } | null;
  thresholds: CalibrationThresholds;
  metrics: { completedEvaluations: number; averageOverallVariance: number | null; highDisagreementProjects: number; calibrationRequiredProjects: number; judgesOutsideExpectedRange: number; consensusReviewsPending: number };
  judges: CalibrationJudgeRow[];
  submissions: CalibrationSubmissionRow[];
  outliers: CalibrationOutlier[];
  finalists: CalibrationSubmissionRow[];
};

function iso(value: Date | null | undefined) { return value ? value.toISOString() : null; }

async function loadCalibrationContext(eventId: string) {
  const [eventRows, submissionRows, assignmentRows, scoreRows, judgeRows, memberRows, finalistRows, thresholdRows, consensusRows] = await Promise.all([
    db.select({ id: events.id, name: events.name }).from(events).where(eq(events.id, eventId)).limit(1),
    db.select().from(submissions).where(eq(submissions.eventId, eventId)),
    db.select().from(judgeAssignments),
    db.select().from(humanScores),
    db.select().from(judges),
    db.select().from(teamMembers),
    db.select().from(resultFinalists).where(and(eq(resultFinalists.eventId, eventId), eq(resultFinalists.status, "active"))),
    db.select().from(calibrationThresholds).where(eq(calibrationThresholds.eventId, eventId)).limit(1),
    db.select().from(calibrationConsensusReviews).where(eq(calibrationConsensusReviews.eventId, eventId)),
  ]);
  const submissionIds = new Set(submissionRows.map((row: Submission) => row.id));
  const scopedAssignments = (assignmentRows as Assignment[]).filter((row: Assignment) => submissionIds.has(row.submissionId));
  const assignmentIds = scopedAssignments.map((row: Assignment) => row.id);
  const [assignmentStateRows, evaluationStateRows] = await Promise.all([
    assignmentIds.length ? db.select().from(judgingAssignmentStates).where(inArray(judgingAssignmentStates.assignmentId, assignmentIds)) : Promise.resolve([] as AssignmentState[]),
    assignmentIds.length ? db.select().from(judgingEvaluationStates).where(inArray(judgingEvaluationStates.assignmentId, assignmentIds)) : Promise.resolve([] as EvaluationState[]),
  ]);
  return { event: eventRows[0] ?? null, submissions: submissionRows as Submission[], assignments: scopedAssignments, scores: (scoreRows as Score[]).filter((row: Score) => submissionIds.has(row.submissionId)), judges: judgeRows as Judge[], members: (memberRows as Member[]).filter((row: Member) => submissionIds.has(row.submissionId)), finalists: finalistRows, thresholds: thresholdRows[0], consensus: consensusRows as Consensus[], assignmentStates: assignmentStateRows as AssignmentState[], evaluationStates: evaluationStateRows as EvaluationState[] };
}

function calculateRecords(context: Awaited<ReturnType<typeof loadCalibrationContext>>) {
  const assignmentState = new Map(context.assignmentStates.map((row) => [row.assignmentId, row]));
  const evaluationState = new Map(context.evaluationStates.map((row) => [row.assignmentId, row]));
  const scoreByKey = new Map(context.scores.map((row) => [`${row.judgeId}:${row.submissionId}`, row]));
  const judgeMap = new Map(context.judges.map((row) => [row.id, row]));
  const recordsBySubmission = new Map<string, EvaluationRecord[]>();
  const activeAssignments = context.assignments.filter((assignment) => { const state = assignmentState.get(assignment.id); return state?.status !== "removed" && state?.status !== "superseded" && state?.conflictStatus === "clear"; });
  for (const assignment of activeAssignments) {
    const state = evaluationState.get(assignment.id)?.status;
    const score = scoreByKey.get(`${assignment.judgeId}:${assignment.submissionId}`);
    const value = score ? scoreFromRow(score) : null;
    const completed = state === "submitted" || state === "frozen" || (!state && score?.completed === true);
    if (!completed || !score || value === null) continue;
    const judge = judgeMap.get(assignment.judgeId);
    if (!judge) continue;
    const criteria = RESULT_RUBRIC_FIELDS.flatMap(([key, label]) => typeof score[key] === "number" ? [{ key: String(key), label: String(label), value: score[key] as number }] : []);
    const list = recordsBySubmission.get(assignment.submissionId) ?? [];
    list.push({ assignment, judge, score, value, criteria });
    recordsBySubmission.set(assignment.submissionId, list);
  }
  return { assignmentState, evaluationState, recordsBySubmission, activeAssignments, judgeMap };
}

export async function getCalibrationData(eventId: string): Promise<CalibrationData> {
  const context = await loadCalibrationContext(eventId);
  if (!context.event) return { event: null, thresholds: DEFAULT_CALIBRATION_THRESHOLDS, metrics: { completedEvaluations: 0, averageOverallVariance: null, highDisagreementProjects: 0, calibrationRequiredProjects: 0, judgesOutsideExpectedRange: 0, consensusReviewsPending: 0 }, judges: [], submissions: [], outliers: [], finalists: [] };
  const thresholds: CalibrationThresholds = { overallVariance: context.thresholds?.overallVarianceThreshold ?? DEFAULT_CALIBRATION_THRESHOLDS.overallVariance, criterionVariance: context.thresholds?.criterionVarianceThreshold ?? DEFAULT_CALIBRATION_THRESHOLDS.criterionVariance, outlierDifference: context.thresholds?.outlierDifferenceThreshold ?? DEFAULT_CALIBRATION_THRESHOLDS.outlierDifference, minimumEvaluations: context.thresholds?.minimumEvaluations ?? DEFAULT_CALIBRATION_THRESHOLDS.minimumEvaluations };
  const records = calculateRecords(context);
  const resultData = await getResultsData(eventId);
  const resultBySubmission = new Map(resultData.rows.map((row) => [row.submissionId, row]));
  const memberBySubmission = new Map<string, string>();
  for (const member of context.members) if (!memberBySubmission.has(member.submissionId)) memberBySubmission.set(member.submissionId, member.affiliation?.trim() || "Institution not listed");
  const finalistSet = new Set(context.finalists.map((row: InferSelectModel<typeof resultFinalists>) => row.submissionId));
  const consensusBySubmission = new Map(context.consensus.map((row) => [row.submissionId, row]));
  const outliers: CalibrationOutlier[] = [];
  const submissionsRows: CalibrationSubmissionRow[] = context.submissions.map((submission) => {
    const values = records.recordsBySubmission.get(submission.id) ?? [];
    const overallValues = values.map((record) => record.value);
    const average = overallValues.length ? roundValue(overallValues.reduce((sum, value) => sum + value, 0) / overallValues.length) : null;
    const variance = populationVariance(overallValues);
    const criterionVariances = RESULT_RUBRIC_FIELDS.map(([key]) => populationVariance(values.map((record) => record.score[key]).filter((value): value is number => typeof value === "number")));
    const criterionVariance = criterionVariances.filter((value): value is number => value !== null).length ? Math.max(...criterionVariances.filter((value): value is number => value !== null)) : null;
    const panelAverage = average ?? 0;
    for (const record of values) {
      const overallDeviation = roundValue(Math.abs(record.value - panelAverage));
      for (const criterion of record.criteria) {
        const criterionValues = values.map((item) => item.score[criterion.key as keyof Score]).filter((value): value is number => typeof value === "number");
        const criterionAverage = criterionValues.length ? criterionValues.reduce((sum, value) => sum + value, 0) / criterionValues.length : criterion.value;
        const difference = roundValue(Math.abs(criterion.value - criterionAverage));
        if (difference * difference >= thresholds.criterionVariance || overallDeviation >= thresholds.outlierDifference) outliers.push({ submissionId: submission.id, projectTitle: submission.projectTitle || "Untitled project", judgeId: record.judge.id, judgeName: record.judge.name, criterion: criterion.label, difference, overallDeviation, reason: "Statistical outlier" });
      }
    }
    const outlierCount = outliers.filter((item) => item.submissionId === submission.id).length;
    const result = resultBySubmission.get(submission.id);
    const highDisagreement = values.length >= thresholds.minimumEvaluations && ((variance ?? 0) >= thresholds.overallVariance || (criterionVariance ?? 0) >= thresholds.criterionVariance);
    const persisted = consensusBySubmission.get(submission.id);
    const consensusStatus = persisted?.status ?? (highDisagreement || finalistSet.has(submission.id) ? "suggested" : "not_required");
    const tie = Boolean(result?.tieKey);
    return { submissionId: submission.id, projectTitle: submission.projectTitle || "Untitled project", teamName: submission.teamName, institution: memberBySubmission.get(submission.id) || "Institution not listed", rank: result?.rank ?? null, average, median: medianValue(overallValues), variance, standardDeviation: variance === null ? null : roundValue(Math.sqrt(variance)), spread: overallValues.length ? roundValue(Math.max(...overallValues) - Math.min(...overallValues)) : null, high: overallValues.length ? Math.max(...overallValues) : null, low: overallValues.length ? Math.min(...overallValues) : null, completed: values.length, required: records.activeAssignments.filter((assignment) => assignment.submissionId === submission.id).length, criterionVariance, consensusStatus, finalist: finalistSet.has(submission.id), tie, needsReview: highDisagreement || outlierCount > 0 || tie, readyForAward: finalistSet.has(submission.id) && consensusStatus === "complete" && !tie, outlierCount };
  });
  const allPanelMeans = submissionsRows.flatMap((submission) => { const values = records.recordsBySubmission.get(submission.submissionId) ?? []; return values.map((record) => ({ judgeId: record.judge.id, value: record.value, panel: submission.average ?? record.value })); });
  const judgeRows = context.judges.map((judge) => {
    const own = allPanelMeans.filter((row) => row.judgeId === judge.id);
    const deviations = own.map((row) => Math.abs(row.value - row.panel));
    const average = own.length ? own.reduce((sum, row) => sum + row.value, 0) / own.length : null;
    const panelAverage = own.length ? own.reduce((sum, row) => sum + row.panel, 0) / own.length : null;
    const outlierCount = outliers.filter((row) => row.judgeId === judge.id).length;
    const status = classifyCalibrationStatus({ completed: own.length, averageDeviation: deviations.length ? roundValue(deviations.reduce((sum, value) => sum + value, 0) / deviations.length) : null, averageScore: average === null ? null : roundValue(average), panelAverage: panelAverage === null ? null : roundValue(panelAverage), outlierCount, minimumEvaluations: thresholds.minimumEvaluations });
    return { id: judge.id, name: judge.name, institution: "Institution not listed", completed: own.length, average: average === null ? null : roundValue(average), median: medianValue(own.map((row) => row.value)), standardDeviation: populationVariance(own.map((row) => row.value)) === null ? null : roundValue(Math.sqrt(populationVariance(own.map((row) => row.value)) ?? 0)), averageDeviation: deviations.length ? roundValue(deviations.reduce((sum, value) => sum + value, 0) / deviations.length) : null, highestDisagreement: deviations.length ? roundValue(Math.max(...deviations)) : null, lowestDisagreement: deviations.length ? roundValue(Math.min(...deviations)) : null, status, needsReview: status === "Needs review" || status === "Slightly lenient" || status === "Slightly strict" };
  });
  const varianceRows = submissionsRows.filter((row) => row.variance !== null && row.completed >= thresholds.minimumEvaluations);
  return { event: context.event, thresholds, metrics: { completedEvaluations: records.recordsBySubmission.size ? [...records.recordsBySubmission.values()].reduce((sum, rows) => sum + rows.length, 0) : 0, averageOverallVariance: varianceRows.length ? roundValue(varianceRows.reduce((sum, row) => sum + (row.variance ?? 0), 0) / varianceRows.length) : null, highDisagreementProjects: submissionsRows.filter((row) => row.needsReview && row.completed >= thresholds.minimumEvaluations).length, calibrationRequiredProjects: submissionsRows.filter((row) => row.needsReview).length, judgesOutsideExpectedRange: judgeRows.filter((row) => row.needsReview).length, consensusReviewsPending: submissionsRows.filter((row) => row.consensusStatus === "suggested" || row.consensusStatus === "in_review" || row.consensusStatus === "flagged").length }, judges: judgeRows, submissions: submissionsRows, outliers, finalists: submissionsRows.filter((row) => row.finalist) };
}

export async function getCalibrationSubmissionDetail(eventId: string, submissionId: string) {
  const context = await loadCalibrationContext(eventId);
  const submission = context.submissions.find((row) => row.id === submissionId);
  if (!submission) return null;
  const data = await getCalibrationData(eventId);
  const row = data.submissions.find((item) => item.submissionId === submissionId);
  if (!row) return null;
  const records = calculateRecords(context).recordsBySubmission.get(submissionId) ?? [];
  const criterionBreakdown = RESULT_RUBRIC_FIELDS.map(([key, label]) => { const values = records.map((record) => record.score[key]).filter((value): value is number => typeof value === "number"); return { key, label, average: values.length ? roundValue(values.reduce((sum, value) => sum + value, 0) / values.length, 1) : null, minimum: values.length ? Math.min(...values) : null, maximum: values.length ? Math.max(...values) : null, variance: populationVariance(values) }; });
  return { row, project: { title: submission.projectTitle || "Untitled project", team: submission.teamName, state: submission.status, repository: submission.githubUrl, demo: submission.demoUrl }, criterionBreakdown, evaluations: records.map((record) => ({ judgeId: record.judge.id, judgeName: record.judge.name, score: record.value, criteria: record.criteria, updatedAt: iso(record.score.updatedAt), privateNoteCount: record.score.privateNotes?.trim() ? 1 : 0 })), consensus: context.consensus.find((item) => item.submissionId === submissionId) ?? null, outliers: data.outliers.filter((item) => item.submissionId === submissionId) };
}

export async function getCalibrationJudgeDetail(eventId: string, judgeId: string) {
  const context = await loadCalibrationContext(eventId);
  const judge = context.judges.find((row) => row.id === judgeId);
  if (!judge) return null;
  const records = calculateRecords(context);
  const evaluations = [...records.recordsBySubmission.values()].flat().filter((record) => record.judge.id === judgeId);
  return { judge: { id: judge.id, name: judge.name, institution: "Institution not listed" }, evaluations: evaluations.map((record) => ({ submissionId: record.assignment.submissionId, score: record.value, updatedAt: iso(record.score.updatedAt), projectTitle: context.submissions.find((submission) => submission.id === record.assignment.submissionId)?.projectTitle || "Untitled project" })), distribution: evaluations.map((record) => record.value) };
}
