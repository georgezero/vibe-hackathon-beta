import { db } from "@/lib/db";
import { aiReviews, audienceVotes, humanScores, judgeAssignments, judges, submissions } from "@/lib/db/schema";
import { inArray, sql, type InferSelectModel } from "drizzle-orm";

const HUMAN_WEIGHT = 0.7;
const AI_WEIGHT = 0.3;
const OUTLIER_THRESHOLD = 20;

const RUBRIC_FIELDS = [
  "problemSelection",
  "productUsefulness",
  "functionality",
  "uxDesign",
  "aiCollaboration",
  "originality",
  "maintainability",
  "presentationClarity",
] as const;

type Submission = InferSelectModel<typeof submissions>;
type HumanScore = InferSelectModel<typeof humanScores>;
type AiReview = InferSelectModel<typeof aiReviews>;
type Judge = Pick<InferSelectModel<typeof judges>, "id" | "name" | "email">;
type Assignment = InferSelectModel<typeof judgeAssignments>;
type VoteCountRow = { submissionId: string; count: number };

export interface HumanScoreSummary {
  id: string;
  submissionId: string;
  judgeId: string;
  judgeName: string;
  score: number | null;
  completed: boolean;
  recommendation: string | null;
}

export interface FinalRanking {
  submissionId: string;
  projectTitle: string | null;
  teamName: string;
  status: string;
  rank: number | null;
  officialScore: number | null;
  humanAverageScore: number | null;
  aiReproducibilityScore: number | null;
  aiOverallScore: number | null;
  audienceVotes: number;
  audienceScore: number;
  judgeCompletionCount: number;
  totalAssignedJudges: number;
  rankStatus: "incomplete" | "provisional" | "final";
  warnings: string[];
  humanScores: HumanScoreSummary[];
  scoringFormula: string;
}

export interface PeoplesChoiceRanking {
  submissionId: string;
  projectTitle: string | null;
  teamName: string;
  rank: number;
  audienceVotes: number;
}

export interface JudgeCalibration {
  judgeId: string;
  judgeName: string;
  judgeEmail: string;
  reviewsAssigned: number;
  reviewsCompleted: number;
  averageScoreGiven: number | null;
  standardDeviation: number | null;
  averageDeviationFromPanelMean: number | null;
  outlierCount: number;
}

export interface RankingData {
  rankings: FinalRanking[];
  peoplesChoiceRankings: PeoplesChoiceRanking[];
  judgeCalibration: JudgeCalibration[];
  humanScores: HumanScoreSummary[];
  aiReviews: AiReview[];
  voteCounts: Record<string, number>;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function rubricScore(score: HumanScore): number | null {
  const values = RUBRIC_FIELDS.map((field) => score[field]).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return round1((values.reduce((sum, value) => sum + value, 0) / values.length) * 10);
}

function standardDeviation(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return round1(Math.sqrt(variance));
}

function reproducibilityScore(review: AiReview | undefined): number | null {
  const details = review?.scoringDetails as { reproducibility_score?: unknown } | null;
  return typeof details?.reproducibility_score === "number" ? details.reproducibility_score : review?.generatedScore ?? null;
}

export async function getRankingData(): Promise<RankingData> {
  const subRows: Submission[] = await db.select().from(submissions);
  const subIds = subRows.map((s: Submission) => s.id);
  const judgeRows: Judge[] = await db.select({
    id: judges.id,
    name: judges.name,
    email: judges.email,
  }).from(judges);
  const judgeMap = Object.fromEntries(judgeRows.map((j: Judge) => [j.id, j]));

  const [scoreRows, assignmentRows, reviewRows, voteRows] = subIds.length === 0
    ? [[], [], [], []] as [HumanScore[], Assignment[], AiReview[], VoteCountRow[]]
    : await Promise.all([
      db.select().from(humanScores).where(inArray(humanScores.submissionId, subIds)),
      db.select().from(judgeAssignments).where(inArray(judgeAssignments.submissionId, subIds)),
      db.select().from(aiReviews).where(inArray(aiReviews.submissionId, subIds)),
      db
        .select({ submissionId: audienceVotes.submissionId, count: sql<number>`cast(count(*) as integer)` })
        .from(audienceVotes)
        .where(inArray(audienceVotes.submissionId, subIds))
        .groupBy(audienceVotes.submissionId),
    ]);

  const voteCounts = Object.fromEntries(voteRows.map((v: VoteCountRow) => [v.submissionId, v.count]));
  const maxVotes = Math.max(...Object.values(voteCounts), 0);
  const assignmentsBySubmission: Record<string, Assignment[]> = {};
  const scoresBySubmission: Record<string, HumanScoreSummary[]> = {};
  const reviewMap = Object.fromEntries(reviewRows.map((r: AiReview) => [r.submissionId, r]));

  for (const assignment of assignmentRows) {
    (assignmentsBySubmission[assignment.submissionId] ??= []).push(assignment);
  }

  const allHumanScores: HumanScoreSummary[] = scoreRows.map((score: HumanScore) => ({
    id: score.id,
    submissionId: score.submissionId,
    judgeId: score.judgeId,
    judgeName: judgeMap[score.judgeId]?.name ?? score.judgeId,
    score: score.completed ? rubricScore(score) : null,
    completed: score.completed,
    recommendation: score.recommendation,
  }));

  for (const score of allHumanScores) {
    (scoresBySubmission[score.submissionId] ??= []).push(score);
  }

  const panelMeanBySubmission: Record<string, number> = {};
  for (const sub of subRows) {
    const completedScores = (scoresBySubmission[sub.id] ?? [])
      .filter((score) => score.completed && score.score !== null)
      .map((score) => score.score as number);
    if (completedScores.length > 0) {
      panelMeanBySubmission[sub.id] = completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length;
    }
  }

  const rankings: FinalRanking[] = subRows.map((sub) => {
    const completedScores = (scoresBySubmission[sub.id] ?? [])
      .filter((score) => score.completed && score.score !== null)
      .map((score) => score.score as number);
    const totalAssignedJudges = assignmentsBySubmission[sub.id]?.length ?? 0;
    const judgeCompletionCount = completedScores.length;
    const humanAverageScore = completedScores.length > 0
      ? round1(completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length)
      : null;
    const review = reviewMap[sub.id];
    const aiOverallScore = review?.generatedScore ?? null;
    const aiReproducibilityScore = reproducibilityScore(review);
    const audienceVotesForSubmission = voteCounts[sub.id] ?? 0;
    const audienceScore = maxVotes > 0 ? round1((audienceVotesForSubmission / maxVotes) * 100) : 0;
    const officialScore = humanAverageScore !== null && aiReproducibilityScore !== null
      ? round1(humanAverageScore * HUMAN_WEIGHT + aiReproducibilityScore * AI_WEIGHT)
      : null;
    const warnings: string[] = [];
    if (!review || review.status !== "complete") warnings.push("missing AI review");
    if (totalAssignedJudges === 0 || judgeCompletionCount < totalAssignedJudges) warnings.push("incomplete judge reviews");
    if (audienceVotesForSubmission === 0) warnings.push("no audience votes");
    if (review?.complianceCheck === "partial" || review?.complianceCheck === "fail") warnings.push("repo validation warning");
    if ((scoresBySubmission[sub.id] ?? []).some((score) => score.score !== null && Math.abs(score.score - (panelMeanBySubmission[sub.id] ?? score.score)) >= OUTLIER_THRESHOLD)) {
      warnings.push("judge score outlier");
    }
    const rankStatus = officialScore === null
      ? "incomplete"
      : judgeCompletionCount < totalAssignedJudges
      ? "provisional"
      : "final";

    return {
      submissionId: sub.id,
      projectTitle: sub.projectTitle,
      teamName: sub.teamName,
      status: sub.status,
      rank: null,
      officialScore,
      humanAverageScore,
      aiReproducibilityScore,
      aiOverallScore,
      audienceVotes: audienceVotesForSubmission,
      audienceScore,
      judgeCompletionCount,
      totalAssignedJudges,
      rankStatus,
      warnings,
      humanScores: scoresBySubmission[sub.id] ?? [],
      scoringFormula: "official_score = human_average_score * 70% + ai_reproducibility_score * 30%. Audience votes are ranked separately for People's Choice.",
    };
  });

  rankings
    .filter((r) => r.officialScore !== null)
    .sort((a, b) => (b.officialScore ?? 0) - (a.officialScore ?? 0))
    .forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

  rankings.sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));

  const judgeCalibration: JudgeCalibration[] = judgeRows.map((judge: Judge) => {
    const assigned = assignmentRows.filter((a: Assignment) => a.judgeId === judge.id).length;
    const judgeScores = allHumanScores.filter((score: HumanScoreSummary) => score.judgeId === judge.id && score.completed && score.score !== null);
    const values = judgeScores.map((score: HumanScoreSummary) => score.score as number);
    const deviations = judgeScores.map((score: HumanScoreSummary) => Math.abs((score.score as number) - (panelMeanBySubmission[score.submissionId] ?? score.score as number)));
    return {
      judgeId: judge.id,
      judgeName: judge.name,
      judgeEmail: judge.email,
      reviewsAssigned: assigned,
      reviewsCompleted: values.length,
      averageScoreGiven: values.length > 0 ? round1(values.reduce((sum, score) => sum + score, 0) / values.length) : null,
      standardDeviation: standardDeviation(values),
      averageDeviationFromPanelMean: deviations.length > 0 ? round1(deviations.reduce((sum, deviation) => sum + deviation, 0) / deviations.length) : null,
      outlierCount: deviations.filter((deviation) => deviation >= OUTLIER_THRESHOLD).length,
    };
  });

  const peoplesChoiceRankings: PeoplesChoiceRanking[] = subRows
    .map((sub) => ({
      submissionId: sub.id,
      projectTitle: sub.projectTitle,
      teamName: sub.teamName,
      rank: 0,
      audienceVotes: voteCounts[sub.id] ?? 0,
    }))
    .sort((a, b) => b.audienceVotes - a.audienceVotes)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return { rankings, peoplesChoiceRankings, judgeCalibration, humanScores: allHumanScores, aiReviews: reviewRows, voteCounts };
}

export const RANKING_WEIGHTS = {
  human: HUMAN_WEIGHT,
  ai: AI_WEIGHT,
  outlierThreshold: OUTLIER_THRESHOLD,
};
