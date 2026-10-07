import { and, eq, isNull, or } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { humanScores, judgeAssignments, judgingAssignmentStates, submissionMemberships } from "@/lib/db/schema";
import { currentJudgingEventId } from "@/lib/judging-event";
import { resolveJudgePrincipal } from "@/lib/judge-principal";
import { loadSubmissionWorkspaceContext, type WorkspaceContext } from "@/lib/submission-workspace";
import type { ApplicationPrincipal } from "@/lib/application-principal";

export type JudgeWorkspace = {
  context: WorkspaceContext;
  principal: ApplicationPrincipal;
  judge: {
    id: string;
    name: string;
    eventId: string;
  };
  score: typeof humanScores.$inferSelect | null;
};

/**
 * Judge workspaces intentionally use assignment authorization, not participant
 * membership. The synthetic membership below is presentation context only;
 * every judge route enters through this assignment-scoped resolver.
 */
export async function requireJudgeWorkspace(
  submissionId: string,
  requestHeaders: Headers,
): Promise<JudgeWorkspace> {
  const resolution = await resolveJudgePrincipal(requestHeaders, {
    eventId: currentJudgingEventId(),
  });
  if (resolution.status === "signed_out") redirect(`/login?returnTo=${encodeURIComponent(`/judge/projects/${submissionId}`)}`);
  if (resolution.status !== "authorized") {
    redirect(`/judge?reason=${resolution.status === "unavailable" ? "unavailable" : "not_authorized"}`);
  }

  const { applicationPrincipal, judgeProfile, event } = resolution.principal;
  const assignment = (await db.select({ id: judgeAssignments.id }).from(judgeAssignments).leftJoin(judgingAssignmentStates, eq(judgingAssignmentStates.assignmentId, judgeAssignments.id)).where(and(
    eq(judgeAssignments.judgeId, judgeProfile.id),
    eq(judgeAssignments.submissionId, submissionId),
    or(isNull(judgingAssignmentStates.status), eq(judgingAssignmentStates.status, "active")),
  )).limit(1))[0];
  if (!assignment) notFound();

  const presentationMembership = {
    id: `judge-view:${judgeProfile.id}:${submissionId}`,
    submissionId,
    userId: applicationPrincipal.user.id,
    role: "teammate" as const,
    status: "active" as const,
    invitationId: null,
    invitedAt: null,
    joinedAt: new Date(),
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies typeof submissionMemberships.$inferSelect;

  const context = await loadSubmissionWorkspaceContext(submissionId, presentationMembership);
  if (!context || context.submission.eventId !== event.id) notFound();
  // Assignments must never turn an unsubmitted draft into judge-visible work.
  // The submission status remains the authoritative review boundary.
  if (!['submitted', 'finalized', 'locked'].includes(context.submission.status)) notFound();
  const score = (await db.select().from(humanScores).where(and(
    eq(humanScores.submissionId, submissionId),
    eq(humanScores.judgeId, judgeProfile.id),
  )).limit(1))[0] ?? null;

  return {
    context,
    principal: applicationPrincipal,
    judge: { id: judgeProfile.id, name: judgeProfile.name, eventId: event.id },
    score,
  };
}
