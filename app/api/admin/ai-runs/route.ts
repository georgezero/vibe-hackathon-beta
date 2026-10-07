import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, aiReviews, aiJudgeRuns } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { parseGithubUrl, fetchRepoFiles } from "@/lib/github-fetch";
import { scoreSubmission } from "@/lib/repo-scorer";
import { runLLMJudge, type LLMJudgeInput } from "@/lib/llm-judge";
import { getActiveEvent } from "@/lib/events";
import { assertEventNotFrozen } from "@/lib/event-freeze";
import { withAdminApi } from "@/lib/admin-api";

// GET /api/admin/ai-runs?submissionId=xxx
async function getAiRuns(req: NextRequest) {
  const submissionId = req.nextUrl.searchParams.get("submissionId");

  const rows = submissionId
    ? await db.select().from(aiJudgeRuns).where(eq(aiJudgeRuns.submissionId, submissionId)).orderBy(desc(aiJudgeRuns.createdAt))
    : await db.select().from(aiJudgeRuns).orderBy(desc(aiJudgeRuns.createdAt));

  return NextResponse.json(rows);
}

// POST /api/admin/ai-runs
// Body: { submissionId, modelProvider, modelName }
async function createAiRun(req: NextRequest) {
  try {
    const freeze = await assertEventNotFrozen();
    if (freeze.response) return NextResponse.json({ error: "Event is frozen. AI evaluation workflows are locked.", eventFrozen: true }, { status: 403 });

    const body = await req.json() as { submissionId?: string; modelProvider?: string; modelName?: string };
    const { submissionId, modelProvider = "mock", modelName = "mock" } = body;

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId required" }, { status: 400 });
    }

    const subRows = await db.select().from(submissions).where(eq(submissions.id, submissionId));
    const sub = subRows[0];
    if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

    const activeEvent = await getActiveEvent();
    const runId = `ajr_${nanoid(8)}`;

    await db.insert(aiJudgeRuns).values({
      id: runId,
      submissionId,
      eventId: activeEvent.id,
      modelProvider,
      modelName,
      status: "running",
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Fetch GitHub files (skip for mock provider to avoid rate limits in testing)
    let files = null;
    let deterministicScore = null;
    const inputSummaryParts: string[] = [`team:${sub.teamName}`];

    if (modelProvider !== "mock" && sub.githubUrl) {
      const coords = parseGithubUrl(sub.githubUrl);
      if (coords) {
        try {
          files = await fetchRepoFiles(coords);
          deterministicScore = scoreSubmission(files);
        } catch {
          // non-fatal — proceed without file content
        }
      }
    } else {
      // For mock: pull deterministic score from existing aiReview if present
      const reviewRows = await db.select().from(aiReviews).where(eq(aiReviews.submissionId, submissionId));
      if (reviewRows[0]?.scoringDetails) {
        deterministicScore = reviewRows[0].scoringDetails as Parameters<typeof scoreSubmission>[0] extends infer T ? never : never;
        // just pass through as-is for the input summary
        const sd = reviewRows[0].scoringDetails as Record<string, unknown>;
        if (typeof sd?.overall_score === "number") inputSummaryParts.push(`det_score:${sd.overall_score}`);
      }
    }

    if (sub.githubUrl) inputSummaryParts.push(`github:${sub.githubUrl}`);
    if (sub.projectTitle) inputSummaryParts.push(`title:${sub.projectTitle}`);

    const input: LLMJudgeInput = {
      submissionId,
      submission: {
        projectTitle: sub.projectTitle,
        problemStatement: sub.problemStatement,
        teamName: sub.teamName,
        githubUrl: sub.githubUrl,
        demoUrl: sub.demoUrl,
        budgetTier: sub.budgetTier,
        estimatedHumanHours: sub.estimatedHumanHours,
        estimatedAgentHours: sub.estimatedAgentHours,
        agentModels: sub.agentModels as string[] | null,
        agentHarnesses: sub.agentHarnesses as string[] | null,
        license: sub.license,
      },
      files,
      deterministicScore: deterministicScore as Parameters<typeof runLLMJudge>[0]["deterministicScore"],
    };

    try {
      const scores = await runLLMJudge(input, modelProvider, modelName);

      await db.update(aiJudgeRuns).set({
        status: "complete",
        completedAt: new Date(),
        inputSummary: inputSummaryParts.join("; "),
        scoresJson: scores as unknown as Record<string, unknown>,
        rationale: scores.rationale,
        updatedAt: new Date(),
      }).where(eq(aiJudgeRuns.id, runId));

      return NextResponse.json({ id: runId, status: "complete", scores });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await db.update(aiJudgeRuns).set({
        status: "failed",
        completedAt: new Date(),
        error,
        updatedAt: new Date(),
      }).where(eq(aiJudgeRuns.id, runId));

      return NextResponse.json({ error, runId }, { status: 500 });
    }
  } catch (err) {
    console.error("POST /api/admin/ai-runs error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withAdminApi("GET /api/admin/ai-runs", getAiRuns);
export const POST = withAdminApi("POST /api/admin/ai-runs", createAiRun);
