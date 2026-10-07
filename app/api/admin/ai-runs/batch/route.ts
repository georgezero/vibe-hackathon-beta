import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, aiJudgeRuns } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { parseGithubUrl, fetchRepoFiles } from "@/lib/github-fetch";
import { runLLMJudge, type LLMJudgeInput } from "@/lib/llm-judge";
import { getActiveEvent } from "@/lib/events";
import { assertEventNotFrozen } from "@/lib/event-freeze";
import { withAdminApi } from "@/lib/admin-api";

// POST /api/admin/ai-runs/batch
// Body: { modelProvider, modelName, submissionIds? }
// If submissionIds omitted, runs for all submissions with a githubUrl.
async function createAiRunBatch(req: NextRequest) {
  try {
    const freeze = await assertEventNotFrozen();
    if (freeze.response) return NextResponse.json({ error: "Event is frozen. AI evaluation workflows are locked.", eventFrozen: true }, { status: 403 });

    const body = await req.json() as {
      modelProvider?: string;
      modelName?: string;
      submissionIds?: string[];
    };
    const { modelProvider = "mock", modelName = "mock", submissionIds } = body;

    const activeEvent = await getActiveEvent();

    const allSubs = submissionIds?.length
      ? await db.select().from(submissions).where(inArray(submissions.id, submissionIds))
      : await db.select().from(submissions);

    const results: Array<{ submissionId: string; runId: string; status: string; error?: string }> = [];

    for (const sub of allSubs) {
      const runId = `ajr_${nanoid(8)}`;

      await db.insert(aiJudgeRuns).values({
        id: runId,
        submissionId: sub.id,
        eventId: activeEvent.id,
        modelProvider,
        modelName,
        status: "running",
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      let files = null;
      if (modelProvider !== "mock" && sub.githubUrl) {
        const coords = parseGithubUrl(sub.githubUrl);
        if (coords) {
          try { files = await fetchRepoFiles(coords); } catch { /* non-fatal */ }
        }
      }

      const input: LLMJudgeInput = {
        submissionId: sub.id,
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
        deterministicScore: null,
      };

      try {
        const scores = await runLLMJudge(input, modelProvider, modelName);

        await db.update(aiJudgeRuns).set({
          status: "complete",
          completedAt: new Date(),
          inputSummary: `team:${sub.teamName}; title:${sub.projectTitle ?? ""}`,
          scoresJson: scores as unknown as Record<string, unknown>,
          rationale: scores.rationale,
          updatedAt: new Date(),
        }).where(eq(aiJudgeRuns.id, runId));

        results.push({ submissionId: sub.id, runId, status: "complete" });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await db.update(aiJudgeRuns).set({
          status: "failed",
          completedAt: new Date(),
          error,
          updatedAt: new Date(),
        }).where(eq(aiJudgeRuns.id, runId));

        results.push({ submissionId: sub.id, runId, status: "failed", error });
      }
    }

    const succeeded = results.filter((r) => r.status === "complete").length;
    return NextResponse.json({ total: results.length, succeeded, results });
  } catch (err) {
    console.error("POST /api/admin/ai-runs/batch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const POST = withAdminApi("POST /api/admin/ai-runs/batch", createAiRunBatch);
