import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { judgeAssignments, humanScores, judgingAssignmentStates, judgingEvaluationStates, submissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { assertEventNotFrozen } from "@/lib/event-freeze";
import {
  withJudgeApi,
  type JudgeApiAuthorization,
} from "@/lib/judge-api";
import { parseJudgeScorePayload } from "@/lib/judge-score";
import { logJudgeAudit } from "@/lib/judge-audit";

async function saveScore(
  req: NextRequest,
  _context: unknown,
  authorization: JudgeApiAuthorization,
) {
  try {
    const freeze = await assertEventNotFrozen();
    if (freeze.response) return NextResponse.json({ error: "Judging has been locked.", eventFrozen: true }, { status: 403 });
    const judge = authorization.judge!;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "A JSON scorecard is required." },
        { status: 400 },
      );
    }
    const parsed = parseJudgeScorePayload(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { submissionId, scores, notes, recommendation, completed } = parsed.value;

    // Verify submission exists
    const subRows = await db.select({ id: submissions.id }).from(submissions).where(and(
      eq(submissions.id, submissionId),
      eq(submissions.eventId, authorization.eventId!),
    ));
    if (!subRows[0]) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Verify assignment
    const assignRows = await db.select({ assignment: judgeAssignments, state: judgingAssignmentStates }).from(judgeAssignments).leftJoin(judgingAssignmentStates, eq(judgingAssignmentStates.assignmentId, judgeAssignments.id)).where(
      and(eq(judgeAssignments.judgeId, judge.id), eq(judgeAssignments.submissionId, submissionId))
    );
    if (!assignRows[0] || assignRows[0].state?.status !== "active") {
      return NextResponse.json({ error: "Not assigned to this submission" }, { status: 403 });
    }
    if (assignRows[0].state.conflictStatus !== "clear") {
      return NextResponse.json({ error: "This assignment is not available for evaluation." }, { status: 403 });
    }
    const evaluationState = (await db.select().from(judgingEvaluationStates).where(eq(judgingEvaluationStates.assignmentId, assignRows[0].assignment.id)).limit(1))[0];
    if (evaluationState?.status === "frozen") return NextResponse.json({ error: "This evaluation is frozen." }, { status: 403 });
    if (completed && evaluationState && !["draft", "reopened", "submitted"].includes(evaluationState.status)) return NextResponse.json({ error: "This evaluation cannot be submitted from its current state." }, { status: 409 });

    // Upsert score
    const existingRows = await db.select().from(humanScores).where(
      and(eq(humanScores.submissionId, submissionId), eq(humanScores.judgeId, judge.id))
    );

    const scoreData = {
      submissionId,
      judgeId: judge.id,
      problemSelection: scores.problemSelection,
      productUsefulness: scores.productUsefulness,
      functionality: scores.functionality,
      uxDesign: scores.uxDesign,
      aiCollaboration: scores.aiCollaboration,
      originality: scores.originality,
      maintainability: scores.maintainability,
      presentationClarity: scores.presentationClarity,
      privateNotes: notes,
      recommendation,
      completed,
      updatedAt: new Date(),
    };

    if (existingRows[0]) {
      await db.update(humanScores).set(scoreData).where(eq(humanScores.id, existingRows[0].id));
    } else {
      await db.insert(humanScores).values({
        id: nanoid(),
        ...scoreData,
        createdAt: new Date(),
      });
    }
    const nextEvaluationStatus = completed ? "submitted" : "draft";
    const stateRows = await db.select().from(judgingEvaluationStates).where(eq(judgingEvaluationStates.assignmentId, assignRows[0].assignment.id)).limit(1);
    if (stateRows[0]) {
      await db.update(judgingEvaluationStates).set({ status: nextEvaluationStatus, changedAt: new Date(), updatedAt: new Date() }).where(eq(judgingEvaluationStates.assignmentId, assignRows[0].assignment.id));
    } else {
      await db.insert(judgingEvaluationStates).values({ id: nanoid(), assignmentId: assignRows[0].assignment.id, status: nextEvaluationStatus, createdAt: new Date(), updatedAt: new Date() });
    }
    await logJudgeAudit(
      existingRows[0] ? "judge_score_updated" : "judge_score_created",
      {
        userId: authorization.applicationUserId,
        judgeId: judge.id,
        authorizationId: authorization.judgeAuthorizationId,
        eventId: authorization.eventId,
        submissionId,
      },
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/scores error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withJudgeApi("POST /api/scores", saveScore);
