const SCORE_FIELDS = [
  "problemSelection",
  "productUsefulness",
  "functionality",
  "uxDesign",
  "aiCollaboration",
  "originality",
  "maintainability",
  "presentationClarity",
] as const;

const RECOMMENDATIONS = new Set(["strong-yes", "yes", "maybe", "no"]);

export interface ValidJudgeScorePayload {
  submissionId: string;
  scores: Record<(typeof SCORE_FIELDS)[number], number | null>;
  notes: string | null;
  recommendation: "strong-yes" | "yes" | "maybe" | "no" | null;
  completed: boolean;
}

export type JudgeScorePayloadResult =
  | { ok: true; value: ValidJudgeScorePayload }
  | { ok: false; error: string };

export function parseJudgeScorePayload(input: unknown): JudgeScorePayloadResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "A JSON scorecard is required." };
  }
  const body = input as Record<string, unknown>;
  if (typeof body.submissionId !== "string" || !body.submissionId.trim()) {
    return { ok: false, error: "submissionId is required." };
  }
  if (
    body.scores !== undefined
    && (!body.scores || typeof body.scores !== "object" || Array.isArray(body.scores))
  ) {
    return { ok: false, error: "scores must be an object." };
  }

  const rawScores = (body.scores ?? {}) as Record<string, unknown>;
  const scores = {} as ValidJudgeScorePayload["scores"];
  for (const field of SCORE_FIELDS) {
    const value = rawScores[field];
    if (value === undefined || value === null) {
      scores[field] = null;
      continue;
    }
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 10) {
      return { ok: false, error: "Every rubric score must be an integer from 1 to 10." };
    }
    scores[field] = value as number;
  }

  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== "string") {
    return { ok: false, error: "notes must be text." };
  }
  if (body.completed !== undefined && typeof body.completed !== "boolean") {
    return { ok: false, error: "completed must be a boolean." };
  }

  const rawRecommendation = body.recommendation === ""
    ? null
    : body.recommendation ?? null;
  if (
    rawRecommendation !== null
    && (
      typeof rawRecommendation !== "string"
      || !RECOMMENDATIONS.has(rawRecommendation)
    )
  ) {
    return { ok: false, error: "recommendation is invalid." };
  }

  const completed = body.completed === true;
  if (
    completed
    && (
      Object.values(scores).some((value) => value === null)
      || rawRecommendation === null
    )
  ) {
    return {
      ok: false,
      error: "Completed scorecards require every rubric score and a recommendation.",
    };
  }

  return {
    ok: true,
    value: {
      submissionId: body.submissionId.trim(),
      scores,
      notes: typeof body.notes === "string" ? body.notes : null,
      recommendation: rawRecommendation as ValidJudgeScorePayload["recommendation"],
      completed,
    },
  };
}
