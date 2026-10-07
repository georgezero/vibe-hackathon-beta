import { headers } from "next/headers";
import { SubmissionWorkspaceShell } from "@/components/SubmissionWorkspaceShell";
import { requireJudgeWorkspace } from "@/lib/judge-workspace";
import ScoringClient from "@/app/judge/submissions/[submissionId]/ScoringClient";
import { db } from "@/lib/db";
import { judgeAssignments, judgingAssignmentStates, submissions, teamMembers } from "@/lib/db/schema";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function JudgeWorkspaceEvaluationPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  const workspace = await requireJudgeWorkspace(submissionId, await headers());
  const members = await db.select().from(teamMembers).where(eq(teamMembers.submissionId, submissionId)).orderBy(teamMembers.order);
  const assignmentRows = await db.select({ assignment: judgeAssignments }).from(judgeAssignments).leftJoin(judgingAssignmentStates, eq(judgingAssignmentStates.assignmentId, judgeAssignments.id)).where(and(eq(judgeAssignments.judgeId, workspace.judge.id), or(isNull(judgingAssignmentStates.status), eq(judgingAssignmentStates.status, "active"))));
  const submissionIds = assignmentRows.map((row: { assignment: InferSelectModel<typeof judgeAssignments> }) => row.assignment.submissionId);
  const assignedSubs = submissionIds.length > 0
    ? await db.select({ id: submissions.id }).from(submissions).where(and(inArray(submissions.id, submissionIds), eq(submissions.eventId, workspace.judge.eventId)))
    : [];
  const orderedSubmissionIds = submissionIds.filter((id: string) => assignedSubs.some((assigned: { id: string }) => assigned.id === id));
  const sub = workspace.context.submission;
  return <SubmissionWorkspaceShell context={workspace.context} principal={workspace.principal} currentTab="evaluation" viewer="judge" basePath={`/judge/projects/${encodeURIComponent(submissionId)}`}>
    <section className="judge-evaluation-heading"><div><span className="badge badge-default">Judge workspace</span><h2>Evaluation</h2><p>Complete the existing scorecard for this assignment. Notes remain private to your judge record.</p></div><span className={`badge ${workspace.score?.completed ? "badge-success" : "badge-warning"}`}>{workspace.score?.completed ? "Complete" : "In progress"}</span></section>
    <section className="card workspace-panel judge-evaluation-history"><div><h2 className="workspace-panel-title">Evaluation history</h2><p className="workspace-panel-copy">Only your current assignment record is shown here; participant and other-judge notes are never exposed.</p></div><div className="workspace-stat-list"><div className="workspace-stat"><span className="workspace-stat-label">Current record</span><span className="badge badge-default">{workspace.score ? "Saved" : "Not started"}</span></div>{workspace.score && <div className="workspace-stat"><span className="workspace-stat-label">Last saved</span><time className="workspace-stat-label" dateTime={workspace.score.updatedAt.toISOString()}>{workspace.score.updatedAt.toLocaleString()}</time></div>}</div></section>
    <ScoringClient
      embedded
      sub={{ id: sub.id, projectTitle: sub.projectTitle, teamName: sub.teamName, demoUrl: sub.demoUrl, githubUrl: sub.githubUrl, screenshotUrl: sub.screenshotUrl, members: members.map((member: InferSelectModel<typeof teamMembers>) => ({ name: member.name, role: member.role ?? "" })) }}
      existingScore={workspace.score}
      submissionIds={orderedSubmissionIds}
    />
  </SubmissionWorkspaceShell>;
}
