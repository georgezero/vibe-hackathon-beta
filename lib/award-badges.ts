import { db } from "@/lib/db";
import { aiJudgeRuns, aiReviews, type events } from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/events";
import { getRankingData } from "@/lib/rankings";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

type Event = InferSelectModel<typeof events>;
type AiReview = InferSelectModel<typeof aiReviews>;
type AiRun = InferSelectModel<typeof aiJudgeRuns>;

export type AwardBadgeType =
  | "judge-choice"
  | "peoples-choice"
  | "ai-choice"
  | "best-agent-native"
  | "best-presentation";

export interface AwardBadge {
  type: AwardBadgeType;
  label: string;
  icon: string;
  tone: "gold" | "orange" | "purple" | "teal" | "blue";
}

export type AwardBadgeMap = Record<string, AwardBadge[]>;

export const AWARD_BADGES: Record<AwardBadgeType, AwardBadge> = {
  "judge-choice": { type: "judge-choice", label: "Judge Choice", icon: "🏆", tone: "gold" },
  "peoples-choice": { type: "peoples-choice", label: "People's Choice", icon: "🏆", tone: "orange" },
  "ai-choice": { type: "ai-choice", label: "AI Choice", icon: "🤖", tone: "purple" },
  "best-agent-native": { type: "best-agent-native", label: "Best Agent-Native", icon: "⭐", tone: "teal" },
  "best-presentation": { type: "best-presentation", label: "Best Presentation", icon: "⭐", tone: "blue" },
};

function numericScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pushBadge(map: AwardBadgeMap, submissionId: string | undefined, type: AwardBadgeType) {
  if (!submissionId) return;
  const badges = (map[submissionId] ??= []);
  if (!badges.some((badge) => badge.type === type)) badges.push(AWARD_BADGES[type]);
}

function agentNativeScore(review: AiReview): number | null {
  const details = review.scoringDetails as Record<string, unknown> | null;
  if (!details) return null;
  const values = [
    numericScore(details.agent_readiness_score),
    numericScore(details.documentation_score),
    numericScore(details.reproducibility_score),
  ].filter((value): value is number => value !== null);
  return values.length ? round1(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function consensusScores(runs: AiRun[]) {
  const grouped: Record<string, { overall: number[]; presentation: number[] }> = {};
  for (const run of runs) {
    if (run.status !== "complete") continue;
    const scores = run.scoresJson as Record<string, unknown> | null;
    const overall = numericScore(scores?.overall_score);
    const presentation = numericScore(scores?.presentation_score);
    const group = (grouped[run.submissionId] ??= { overall: [], presentation: [] });
    if (overall !== null) group.overall.push(overall);
    if (presentation !== null) group.presentation.push(presentation);
  }
  return grouped;
}

export async function getAwardBadgeMap(options: { preview?: boolean; event?: Event } = {}): Promise<AwardBadgeMap> {
  const event = options.event ?? await getActiveEvent();
  const toggles = event as Event & {
    showJudgeChoice?: boolean;
    showPeoplesChoice?: boolean;
    showAIChoice?: boolean;
    showSpecialAwards?: boolean;
  };

  if (!options.preview && !event.winnersPublishedAt) return {};

  const [rankingData, reviews, runs] = await Promise.all([
    getRankingData(),
    db.select().from(aiReviews),
    db.select().from(aiJudgeRuns),
  ]);

  const map: AwardBadgeMap = {};

  if (toggles.showJudgeChoice !== false) {
    const judgeWinner = rankingData.rankings
      .filter((ranking) => ranking.officialScore !== null)
      .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))[0];
    pushBadge(map, judgeWinner?.submissionId, "judge-choice");
  }

  if (event.audienceVotingEnabled && toggles.showPeoplesChoice !== false) {
    pushBadge(map, rankingData.peoplesChoiceRankings[0]?.submissionId, "peoples-choice");
  }

  const grouped = consensusScores(runs as AiRun[]);

  if (toggles.showAIChoice !== false) {
    const aiWinner = Object.entries(grouped)
      .filter(([, scores]) => scores.overall.length > 0)
      .map(([submissionId, scores]) => ({
        submissionId,
        score: scores.overall.reduce((sum, score) => sum + score, 0) / scores.overall.length,
      }))
      .sort((a, b) => b.score - a.score)[0];
    pushBadge(map, aiWinner?.submissionId, "ai-choice");
  }

  if (toggles.showSpecialAwards !== false) {
    const agentWinner = (reviews as AiReview[])
      .map((review) => ({ submissionId: review.submissionId, score: agentNativeScore(review) }))
      .filter((row): row is { submissionId: string; score: number } => row.score !== null)
      .sort((a, b) => b.score - a.score)[0];
    pushBadge(map, agentWinner?.submissionId, "best-agent-native");

    const presentationWinner = Object.entries(grouped)
      .filter(([, scores]) => scores.presentation.length > 0)
      .map(([submissionId, scores]) => ({
        submissionId,
        score: scores.presentation.reduce((sum, score) => sum + score, 0) / scores.presentation.length,
      }))
      .sort((a, b) => b.score - a.score)[0];
    pushBadge(map, presentationWinner?.submissionId, "best-presentation");
  }

  return map;
}

export async function getAwardBadgesForSubmission(submissionId: string, options: { preview?: boolean; event?: Event } = {}) {
  const map = await getAwardBadgeMap(options);
  return map[submissionId] ?? [];
}
