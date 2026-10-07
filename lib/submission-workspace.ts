import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  submissionMembershipInvitations,
  submissionMemberships,
  submissions,
  teamMembers,
  users,
} from "@/lib/db/schema";
import { computeSubmissionReadiness } from "@/lib/submission-readiness";
import { computePrizeEligibility } from "@/lib/prize-eligibility";
import { getActiveEvent, submissionDeadlineStatus } from "@/lib/events";
import { listProjectActivity } from "@/lib/project-activity";
import { resolveApplicationPrincipal, type ApplicationPrincipalResolution } from "@/lib/application-principal";

export type WorkspaceContext = {
  submission: typeof submissions.$inferSelect;
  membership: typeof submissionMemberships.$inferSelect;
  members: Array<typeof teamMembers.$inferSelect>;
  memberships: Array<{
    membership: typeof submissionMemberships.$inferSelect;
    user: { id: string; name: string | null; email: string };
  }>;
  invitations: Array<typeof submissionMembershipInvitations.$inferSelect>;
  readiness: ReturnType<typeof computeSubmissionReadiness>;
  deadline: ReturnType<typeof submissionDeadlineStatus>;
  eventFrozen: boolean;
  eventName: string;
  activity: Awaited<ReturnType<typeof listProjectActivity>>;
};

export type WorkspaceResolution =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "ok"; context: WorkspaceContext; principal: Extract<ApplicationPrincipalResolution, { status: "authenticated" }>['principal'] };

export async function loadSubmissionWorkspaceContext(
  submissionId: string,
  membership: typeof submissionMemberships.$inferSelect,
): Promise<WorkspaceContext | null> {
  const submission = (await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1))[0];
  if (!submission) return null;

  const [members, membershipRows, invitations, event, activity] = await Promise.all([
    db.select().from(teamMembers).where(eq(teamMembers.submissionId, submissionId)).orderBy(teamMembers.order),
    db.select({ membership: submissionMemberships, user: { id: users.id, name: users.name, email: users.email } })
      .from(submissionMemberships)
      .innerJoin(users, eq(users.id, submissionMemberships.userId))
      .where(eq(submissionMemberships.submissionId, submissionId))
      .orderBy(submissionMemberships.createdAt),
    db.select().from(submissionMembershipInvitations).where(eq(submissionMembershipInvitations.submissionId, submissionId)).orderBy(submissionMembershipInvitations.createdAt),
    getActiveEvent(),
    listProjectActivity(submissionId),
  ]);
  const readiness = computeSubmissionReadiness(submission, members.map((member: typeof teamMembers.$inferSelect) => ({ name: member.name, badgeNumber: member.badgeNumber, isStudentTrainee: member.isStudentTrainee })));
  return {
    submission,
    membership,
    members,
    memberships: membershipRows,
    invitations,
    readiness,
    deadline: submissionDeadlineStatus(event),
    eventFrozen: Boolean(event.isFrozen),
    eventName: event.displayName ?? event.name,
    activity,
  };
}

export async function resolveSubmissionWorkspace(submissionId: string, headers: Headers): Promise<WorkspaceResolution> {
  const principal = await resolveApplicationPrincipal(headers);
  if (principal.status === "unauthenticated") return { status: "unauthenticated" };
  if (principal.status !== "authenticated") return { status: "unavailable" };

  const membership = (await db.select().from(submissionMemberships).where(and(
    eq(submissionMemberships.submissionId, submissionId),
    eq(submissionMemberships.userId, principal.principal.user.id),
    eq(submissionMemberships.status, "active"),
  )).limit(1))[0];
  if (!membership) {
    const submission = (await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.id, submissionId)).limit(1))[0];
    return submission ? { status: "forbidden" } : { status: "not_found" };
  }

  const context = await loadSubmissionWorkspaceContext(submissionId, membership);
  if (!context) return { status: "not_found" };
  return { status: "ok", principal: principal.principal, context };
}

export function workspaceRoleLabel(role: "owner" | "teammate") {
  return role === "owner" ? "Team lead" : "Teammate";
}

export function membershipStatusLabel(status: "invited" | "active" | "revoked") {
  return status === "active" ? "Joined" : status === "invited" ? "Invitation pending" : "Revoked";
}

export function readinessStatusLabel(status: "ready" | "incomplete" | "finalized") {
  if (status === "finalized") return "Submitted";
  return status === "ready" ? "Ready to submit" : "Needs attention";
}

export { computePrizeEligibility };
