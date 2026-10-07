import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { submissions, aiJudgeRuns } from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/events";
import { assertEventNotFrozen } from "@/lib/event-freeze";
import { markEvalTokenUsed, validateEvalToken } from "@/lib/judge-packet";

const SCORE_FIELDS = [
  "product_sense_score",
  "originality_score",
  "execution_score",
  "ai_collaboration_score",
  "usefulness_score",
  "presentation_score",
  "overall_score",
] as const;

interface ImportOptions {
  requiredSubmissionId?: string;
  allowBodyEvaluationToken?: boolean;
}

export async function importAiEvaluation(
  req: NextRequest,
  options: ImportOptions = {},
) {
  const freeze = await assertEventNotFrozen();
  if (freeze.response) {
    return NextResponse.json(
      {
        error: "Event is frozen. AI evaluation imports are locked.",
        eventFrozen: true,
      },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    submission_id: bodySubmissionId,
    evaluation_token,
    provider,
    model_name,
    model,
    external_run_id,
    scores_json,
    scores,
    rationale,
    risk_flags,
    suggested_human_questions,
    raw_response_json,
    token_estimate,
    cost_estimate,
  } = body as {
    submission_id?: string;
    evaluation_token?: string;
    provider?: string;
    model_name?: string;
    model?: string;
    external_run_id?: string;
    scores_json?: Record<string, unknown>;
    scores?: Record<string, unknown>;
    rationale?: string;
    risk_flags?: string[];
    suggested_human_questions?: string[];
    raw_response_json?: Record<string, unknown>;
    token_estimate?: number;
    cost_estimate?: number;
  };

  if (
    options.requiredSubmissionId
    && bodySubmissionId
    && bodySubmissionId !== options.requiredSubmissionId
  ) {
    return NextResponse.json(
      { error: "The submission does not match the scoped evaluation token." },
      { status: 403 },
    );
  }

  if (evaluation_token && !options.allowBodyEvaluationToken) {
    return NextResponse.json(
      { error: "Use the Authorization header for the evaluation token." },
      { status: 400 },
    );
  }

  const submissionId = options.requiredSubmissionId ?? bodySubmissionId;
  const resolvedModel = model_name ?? model;
  const resolvedScores = scores_json ?? scores;

  if (!submissionId) {
    return NextResponse.json({ error: "submission_id is required" }, { status: 400 });
  }
  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }
  if (!resolvedModel) {
    return NextResponse.json({ error: "model_name is required" }, { status: 400 });
  }
  if (!resolvedScores || typeof resolvedScores !== "object") {
    return NextResponse.json(
      { error: "scores_json must be an object" },
      { status: 400 },
    );
  }

  const validationErrors: string[] = [];
  for (const field of SCORE_FIELDS) {
    const value = resolvedScores[field];
    if (value === undefined || value === null) {
      validationErrors.push(`scores_json.${field} is required`);
    } else if (
      typeof value !== "number"
      || Number.isNaN(value)
      || value < 0
      || value > 100
    ) {
      validationErrors.push(
        `scores_json.${field} must be a number 0–100, got: ${value}`,
      );
    }
  }
  if (validationErrors.length > 0) {
    return NextResponse.json(
      { error: "Score validation failed", details: validationErrors },
      { status: 400 },
    );
  }

  const subRows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.id, submissionId));
  if (!subRows[0]) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (
    evaluation_token
    && !await validateEvalToken(submissionId, evaluation_token)
  ) {
    return NextResponse.json(
      { error: "Invalid or expired evaluation token" },
      { status: 403 },
    );
  }

  const fullScores: Record<string, unknown> = { ...resolvedScores };
  if (Array.isArray(risk_flags)) fullScores.risk_flags = risk_flags;
  if (Array.isArray(suggested_human_questions)) {
    fullScores.suggested_human_questions = suggested_human_questions;
  }
  if (rationale) fullScores.rationale = rationale;

  const activeEvent = await getActiveEvent();
  const runId = `ajr_${nanoid(8)}`;

  await db.insert(aiJudgeRuns).values({
    id: runId,
    submissionId,
    eventId: activeEvent.id,
    modelProvider: `external/${provider}`,
    modelName: resolvedModel,
    status: "complete",
    startedAt: new Date(),
    completedAt: new Date(),
    inputSummary: external_run_id
      ? `external_run_id:${external_run_id}`
      : "imported externally",
    scoresJson: fullScores,
    rawResponseJson: raw_response_json ?? null,
    rationale: rationale ?? null,
    tokenEstimate: typeof token_estimate === "number" ? token_estimate : null,
    costEstimate: typeof cost_estimate === "number" ? cost_estimate : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  if (evaluation_token) {
    await markEvalTokenUsed(evaluation_token);
  }

  return NextResponse.json({
    id: runId,
    status: "complete",
    submissionId,
  });
}
