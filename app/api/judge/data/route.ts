import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { judgeAssignments, judgingAssignmentStates, submissions, teamMembers, humanScores } from "@/lib/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import {
  withJudgeApi,
  type JudgeApiAuthorization,
} from "@/lib/judge-api";

async function getJudgeData(
  req: NextRequest,
  _context: unknown,
  authorization: JudgeApiAuthorization,
) {
  try {
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId");

    if (!submissionId) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 },
      );
    }
    const judge = authorization.judge!;

    const assignRows = await db.select().from(judgeAssignments).leftJoin(judgingAssignmentStates, eq(judgingAssignmentStates.assignmentId, judgeAssignments.id)).where(
      and(eq(judgeAssignments.judgeId, judge.id), eq(judgeAssignments.submissionId, submissionId), or(isNull(judgingAssignmentStates.status), eq(judgingAssignmentStates.status, "active")))
    );
    if (!assignRows[0]) {
      return NextResponse.json({ error: "Not assigned to this submission" }, { status: 403 });
    }

    const subRows = await db.select().from(submissions).where(and(
      eq(submissions.id, submissionId),
      eq(submissions.eventId, authorization.eventId!),
    ));
    const sub = subRows[0];
    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const members = await db.select().from(teamMembers)
      .where(eq(teamMembers.submissionId, submissionId))
      .orderBy(teamMembers.order);

    const scoreRows = await db.select().from(humanScores).where(
      and(eq(humanScores.submissionId, submissionId), eq(humanScores.judgeId, judge.id))
    );
    const existingScore = scoreRows[0] ?? null;

    return NextResponse.json({
      judge: { id: judge.id, name: judge.name },
      submission: {
        id: sub.id,
        status: sub.status,
        teamName: sub.teamName,
        projectTitle: sub.projectTitle,
        problemStatement: sub.problemStatement,
        targetUsers: sub.targetUsers,
        demoUrl: sub.demoUrl,
        demoVideoUrl: sub.demoVideoUrl,
        githubUrl: sub.githubUrl,
        screenshotUrl: sub.screenshotUrl,
        screenshotUrls: sub.screenshotUrls ?? [],
        readmeUrl: sub.readmeUrl,
        agentsMdUrl: sub.agentsMdUrl,
        promptStrategyUrl: sub.promptStrategyUrl,
        agentReportUrl: sub.agentReportUrl,
        sampleDataDescription: sub.sampleDataDescription,
        setupInstructions: sub.setupInstructions,
        deployInstructions: sub.deployInstructions,
        knownLimitations: sub.knownLimitations,
        license: sub.license,
        agentHarnesses: sub.agentHarnesses ?? [],
        agentModels: sub.agentModels ?? [],
        budgetTier: sub.budgetTier,
        estimatedHumanHours: sub.estimatedHumanHours,
        estimatedAgentHours: sub.estimatedAgentHours,
        members: members.map((m: { name: string; role: string | null }) => ({ name: m.name, role: m.role ?? "" })),
        tags: (sub.tags as string[]) ?? [],
        aiToolsUsed: (sub.aiToolsUsed as string[]) ?? [],
      },
      existingScore,
    });
  } catch (err) {
    console.error("GET /api/judge/data error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withJudgeApi("GET /api/judge/data", getJudgeData);
