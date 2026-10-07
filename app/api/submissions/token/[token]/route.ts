import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, teamMembers, audienceVotes } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { computeSubmissionEditVersion } from "@/lib/submission-edit-version";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";
import type { InferSelectModel } from "drizzle-orm";

type TeamMember = InferSelectModel<typeof teamMembers>;

interface RouteContext {
  params: Promise<{ token: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;

    const rows = await db.select().from(submissions).where(eq(submissions.editToken, token));
    const sub = rows[0];

    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const members: TeamMember[] = await db.select().from(teamMembers)
      .where(eq(teamMembers.submissionId, sub.id))
      .orderBy(teamMembers.order);
    const event = await getActiveEvent();
    const deadline = submissionDeadlineStatus(event);
    void recordParticipantJourneyEvent({
      eventId: sub.eventId ?? event.id,
      eventType: "participant_editor_viewed",
      context: "editor",
      destination: "editor",
      outcome: "viewed",
    });

    const voteRows = await db.select({ total: count() }).from(audienceVotes).where(eq(audienceVotes.submissionId, sub.id));
    const totalVotes = voteRows[0]?.total ?? 0;

    return NextResponse.json({
      id: sub.id,
      editToken: sub.editToken,
      status: sub.status,
      teamName: sub.teamName,
      contactEmail: sub.contactEmail,
      members: members.map((m: { name: string; role: string | null }) => ({ name: m.name, role: m.role ?? "" })),
      teamSummary: computePrizeEligibility(members.map((m) => ({ name: m.name, badgeNumber: m.badgeNumber, isStudentTrainee: m.isStudentTrainee }))),
      projectTitle: sub.projectTitle ?? "",
      problemStatement: sub.problemStatement ?? "",
      targetUsers: sub.targetUsers ?? "",
      demoUrl: sub.demoUrl ?? "",
      demoVideoUrl: sub.demoVideoUrl ?? null,
      githubUrl: sub.githubUrl ?? "",
      screenshotUrl: sub.screenshotUrl ?? "",
      screenshotUrls: (sub.screenshotUrls as string[] | null) ?? [],
      readmeUrl: sub.readmeUrl ?? "",
      agentsMdUrl: sub.agentsMdUrl ?? "",
      promptStrategyUrl: sub.promptStrategyUrl ?? "",
      sampleDataDescription: sub.sampleDataDescription ?? "",
      setupInstructions: sub.setupInstructions ?? "",
      deployInstructions: sub.deployInstructions ?? "",
      knownLimitations: sub.knownLimitations ?? "",
      aiToolsUsed: (sub.aiToolsUsed as string[]) ?? [],
      tags: (sub.tags as string[]) ?? [],
      audienceVotes: totalVotes,
      createdAt: sub.createdAt?.toISOString() ?? null,
      submittedAt: sub.submittedAt?.toISOString() ?? null,
      finalizedAt: sub.finalizedAt?.toISOString() ?? null,
      editVersion: computeSubmissionEditVersion(sub as unknown as Record<string, unknown>, members as unknown as Record<string, unknown>[]),
      deadlineOpen: deadline.open,
      deadlineLabel: deadline.label,
      eventFrozen: Boolean(event.isFrozen),
      license: sub.license ?? "",
      agentHarnesses: (sub.agentHarnesses as string[]) ?? [],
      agentModels: (sub.agentModels as string[]) ?? [],
      budgetTier: sub.budgetTier ?? "",
      estimatedHumanHours: sub.estimatedHumanHours ?? null,
      estimatedAgentHours: sub.estimatedAgentHours ?? null,
    });
  } catch (err) {
    console.error("GET /api/submissions/token/[token] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
