import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents, events, humanScores, judgeAssignments, judges, judgingAssignmentStates, judgingEvaluationStates, submissions, teamMembers } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type EvaluationState = "not_started" | "draft" | "submitted" | "frozen" | "reopened";
export type AssignmentState = "active" | "superseded" | "removed";
type SubmissionRow = Pick<InferSelectModel<typeof submissions>, "id" | "projectTitle" | "teamName" | "status">;
type AssignmentRow = InferSelectModel<typeof judgeAssignments>;
type ScoreRow = InferSelectModel<typeof humanScores>;
type JudgeRow = Pick<InferSelectModel<typeof judges>, "id" | "name">;
type MemberRow = Pick<InferSelectModel<typeof teamMembers>, "submissionId" | "affiliation">;
type AuditRow = { id: string; action: string; createdAt: Date };

export type CommandCenterData = {
  event: { id: string; name: string; isFrozen: boolean; judgingDeadline: string | null } | null;
  metrics: { submissions: number; assigned: number; requiredEvaluations: number; fullyEvaluated: number; notStarted: number; drafts: number; submitted: number; frozen: number; reopened: number; missing: number; activeJudges: number; judgesWithRemaining: number; completionPercent: number; averageMinutes: number | null };
  health: { state: "Healthy" | "Attention needed" | "Blocked" | "Complete"; reasons: string[] };
  judges: Array<{ id: string; name: string; institution: string; assigned: number; notStarted: number; completed: number; drafts: number; frozen: number; remaining: number; averageMinutes: number | null; lastActivity: string | null; status: string }>;
  submissions: Array<{ id: string; projectTitle: string; teamName: string; institution: string; state: string; assigned: number; notStarted: number; completed: number; drafts: number; frozen: number; reopened: number; missing: number; conflict: boolean; assignmentIds: string[]; lastActivity: string | null }>;
  assignments: Array<{ id: string; submissionId: string; projectTitle: string; judgeId: string; judgeName: string; state: AssignmentState; conflictStatus: string; evaluation: EvaluationState; lastSaved: string | null; scoreId: string | null; privateNotes: boolean }>;
  attention: Array<{ id: string; label: string; detail: string; tone: "warning" | "danger" | "info"; href: string }>;
  activity: Array<{ id: string; label: string; createdAt: string }>;
};

function iso(date: Date | null | undefined) { return date ? date.toISOString() : null; }
function institutionFor(members: Array<{ submissionId: string; affiliation: string | null }>, submissionId: string) {
  return members.find((member) => member.submissionId === submissionId)?.affiliation?.trim() || "Institution not listed";
}

export async function getJudgingCommandCenterData(eventId: string): Promise<CommandCenterData> {
  const event = (await db.select({ id: events.id, name: events.name, isFrozen: events.isFrozen, judgingDeadline: events.judgingDeadline }).from(events).where(eq(events.id, eventId)).limit(1))[0] ?? null;
  const subs: SubmissionRow[] = await db.select({ id: submissions.id, projectTitle: submissions.projectTitle, teamName: submissions.teamName, status: submissions.status }).from(submissions).where(eq(submissions.eventId, eventId));
  const subIds = subs.map((sub) => sub.id);
  const judgeRows: JudgeRow[] = await db.select({ id: judges.id, name: judges.name }).from(judges);
  const assignmentRows: AssignmentRow[] = subIds.length ? await db.select().from(judgeAssignments).where(inArray(judgeAssignments.submissionId, subIds)) : [];
  const scoreRows: ScoreRow[] = subIds.length ? await db.select().from(humanScores).where(inArray(humanScores.submissionId, subIds)) : [];
  const memberRows: MemberRow[] = subIds.length ? await db.select({ submissionId: teamMembers.submissionId, affiliation: teamMembers.affiliation }).from(teamMembers).where(inArray(teamMembers.submissionId, subIds)) : [];
  const auditRows: AuditRow[] = await db.select({ id: auditEvents.id, action: auditEvents.action, createdAt: auditEvents.createdAt }).from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(30);
  const assignmentState = new Map<string, { status: AssignmentState; conflictStatus: string }>();
  const evaluationState = new Map<string, EvaluationState>();
  try {
    const stateIds = assignmentRows.map((row: AssignmentRow) => row.id);
    const states = stateIds.length ? await db.select().from(judgingAssignmentStates).where(inArray(judgingAssignmentStates.assignmentId, stateIds)) : [];
    const evaluations = stateIds.length ? await db.select().from(judgingEvaluationStates).where(inArray(judgingEvaluationStates.assignmentId, stateIds)) : [];
    for (const row of states) assignmentState.set(row.assignmentId, { status: row.status, conflictStatus: row.conflictStatus });
    for (const row of evaluations) evaluationState.set(row.assignmentId, row.status);
  } catch {
    // Before the additive migration, historical assignments are active and the
    // score's completed flag is the only available lifecycle signal.
  }
  const scoreByKey = new Map(scoreRows.map((score) => [`${score.judgeId}:${score.submissionId}`, score]));
  const judgeById = new Map(judgeRows.map((judge) => [judge.id, judge]));
  const assignmentView = assignmentRows.map((assignment) => {
    const score = scoreByKey.get(`${assignment.judgeId}:${assignment.submissionId}`);
    const fallback: EvaluationState = score ? (score.completed ? "submitted" : "draft") : "not_started";
    return { id: assignment.id, submissionId: assignment.submissionId, projectTitle: subs.find((sub) => sub.id === assignment.submissionId)?.projectTitle || "Untitled project", judgeId: assignment.judgeId, judgeName: judgeById.get(assignment.judgeId)?.name || assignment.judgeId, state: assignmentState.get(assignment.id)?.status || "active", conflictStatus: assignmentState.get(assignment.id)?.conflictStatus || "clear", evaluation: evaluationState.get(assignment.id) || fallback, lastSaved: iso(score?.updatedAt), scoreId: score?.id || null, privateNotes: Boolean(score?.privateNotes?.trim()) };
  });
  // A recused, withdrawn, or replacement-required assignment remains visible
  // in the inspector for historical context, but it must not count toward
  // judging coverage or completion. This keeps operational denominators honest
  // while preserving the assignment record and its audit history.
  const activeAssignments = assignmentView.filter((row) => row.state === "active" && row.conflictStatus === "clear");
  const allActiveAssignments = assignmentView.filter((row) => row.state === "active");
  const completed = activeAssignments.filter((row) => row.evaluation === "submitted" || row.evaluation === "frozen");
  const drafts = activeAssignments.filter((row) => row.evaluation === "draft");
  const notStarted = activeAssignments.filter((row) => row.evaluation === "not_started");
  const frozen = activeAssignments.filter((row) => row.evaluation === "frozen");
  const reopened = activeAssignments.filter((row) => row.evaluation === "reopened");
  const submittedBySubmission = new Map<string, number>();
  const assignmentCountBySubmission = new Map<string, number>();
  for (const row of activeAssignments) {
    assignmentCountBySubmission.set(row.submissionId, (assignmentCountBySubmission.get(row.submissionId) || 0) + 1);
    if (row.evaluation === "submitted" || row.evaluation === "frozen") submittedBySubmission.set(row.submissionId, (submittedBySubmission.get(row.submissionId) || 0) + 1);
  }
  const fullyEvaluated = subs.filter((sub) => (assignmentCountBySubmission.get(sub.id) || 0) > 0 && submittedBySubmission.get(sub.id) === assignmentCountBySubmission.get(sub.id)).length;
  const durations = scoreRows.filter((score) => score.completed).map((score) => Math.max(0, (score.updatedAt.getTime() - score.createdAt.getTime()) / 60000));
  const averageMinutes = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
  const judgeViews = judgeRows.map((judge) => {
    const rows = activeAssignments.filter((assignment) => assignment.judgeId === judge.id);
    const done = rows.filter((row) => row.evaluation === "submitted" || row.evaluation === "frozen").length;
    const draft = rows.filter((row) => row.evaluation === "draft" || row.evaluation === "reopened").length;
    const started = rows.filter((row) => row.evaluation !== "not_started").length;
    const frozenCount = rows.filter((row) => row.evaluation === "frozen").length;
    const judgeScores = scoreRows.filter((score) => score.judgeId === judge.id && score.completed);
    const judgeDurations = judgeScores.map((score) => Math.max(0, (score.updatedAt.getTime() - score.createdAt.getTime()) / 60000));
    const last = scoreRows.filter((score) => score.judgeId === judge.id).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.updatedAt || null;
    const status = rows.length === 0 ? "Unavailable" : done === rows.length ? "Complete" : started > 0 ? "In progress" : "Not started";
    return { id: judge.id, name: judge.name, institution: "—", assigned: rows.length, notStarted: rows.length - started, completed: done, drafts: draft, frozen: frozenCount, remaining: Math.max(0, rows.length - done), averageMinutes: judgeDurations.length ? Math.round(judgeDurations.reduce((sum, value) => sum + value, 0) / judgeDurations.length) : null, lastActivity: iso(last), status };
  });
  const submissionViews = subs.map((sub) => {
    const rows = activeAssignments.filter((assignment) => assignment.submissionId === sub.id);
    const allRows = allActiveAssignments.filter((assignment) => assignment.submissionId === sub.id);
    const done = rows.filter((row) => row.evaluation === "submitted" || row.evaluation === "frozen").length;
    const draft = rows.filter((row) => row.evaluation === "draft" || row.evaluation === "reopened").length;
    const notStartedCount = rows.filter((row) => row.evaluation === "not_started").length;
    const frozenCount = rows.filter((row) => row.evaluation === "frozen").length;
    const reopenedCount = rows.filter((row) => row.evaluation === "reopened").length;
    const hasConflict = allRows.some((row) => row.conflictStatus !== "clear");
    const last = scoreRows.filter((score) => score.submissionId === sub.id).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.updatedAt || null;
    return { id: sub.id, projectTitle: sub.projectTitle || "Untitled project", teamName: sub.teamName, institution: institutionFor(memberRows, sub.id), state: sub.status, assigned: rows.length, notStarted: notStartedCount, completed: done, drafts: draft, frozen: frozenCount, reopened: reopenedCount, missing: Math.max(0, rows.length - done), conflict: hasConflict, assignmentIds: rows.map((row) => row.id), lastActivity: iso(last) };
  });
  const attention: CommandCenterData["attention"] = [];
  for (const sub of submissionViews) {
    const href = `/admin/judging?submission=${encodeURIComponent(sub.id)}`;
    if (sub.assigned === 0) attention.push({ id: `unassigned:${sub.id}`, label: "No judges assigned", detail: sub.projectTitle, tone: "danger", href });
    else if (sub.conflict) attention.push({ id: `conflict:${sub.id}`, label: "Conflict requires review", detail: sub.projectTitle, tone: "danger", href });
    else if (sub.missing > 0) attention.push({ id: `missing:${sub.id}`, label: `${sub.missing} evaluation${sub.missing === 1 ? "" : "s"} remaining`, detail: sub.projectTitle, tone: "warning", href });
  }
  for (const judge of judgeViews.filter((row) => row.remaining > 0 && row.status === "Not started")) attention.push({ id: `judge:${judge.id}`, label: "Judge has not started", detail: judge.name, tone: "info", href: `/admin/judging?judge=${encodeURIComponent(judge.id)}` });
  const activity = auditRows.filter((row) => ["judge_score_created", "judge_score_updated", "admin_judging_evaluation_frozen", "admin_judging_evaluation_reopened", "admin_judging_assignment_reassigned"].includes(row.action)).map((row) => ({ id: row.id, label: row.action.replaceAll("_", " "), createdAt: row.createdAt.toISOString() }));
  const healthReasons: string[] = [];
  if (submissionViews.some((sub) => sub.assigned === 0)) healthReasons.push("Submissions have no judge assignment");
  if (submissionViews.some((sub) => sub.conflict)) healthReasons.push("A conflict or recusal needs review");
  if (submissionViews.some((sub) => sub.missing > 0)) healthReasons.push("Evaluations remain outstanding");
  const health = event?.isFrozen && completed.length < activeAssignments.length ? "Attention needed" : healthReasons.some((reason) => reason.includes("no judge") || reason.includes("conflict")) ? "Blocked" : activeAssignments.length > 0 && completed.length === activeAssignments.length ? "Complete" : healthReasons.length ? "Attention needed" : "Healthy";
  return { event: event ? { id: event.id, name: event.name, isFrozen: event.isFrozen, judgingDeadline: iso(event.judgingDeadline) } : null, metrics: { submissions: subs.length, assigned: activeAssignments.length, requiredEvaluations: activeAssignments.length, fullyEvaluated, notStarted: notStarted.length, drafts: drafts.length, submitted: completed.length - frozen.length, frozen: frozen.length, reopened: reopened.length, missing: Math.max(0, activeAssignments.length - completed.length), activeJudges: judgeViews.filter((judge) => judge.assigned > 0).length, judgesWithRemaining: judgeViews.filter((judge) => judge.remaining > 0).length, completionPercent: activeAssignments.length ? Math.round(completed.length / activeAssignments.length * 100) : 0, averageMinutes }, health: { state: health, reasons: healthReasons }, judges: judgeViews, submissions: submissionViews, assignments: assignmentView, attention, activity };
}
