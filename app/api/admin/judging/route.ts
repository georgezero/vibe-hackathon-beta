import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import type { DB } from "@/lib/db";
import { judgeAssignments, judgingAssignmentStates, judgingEvaluationStates } from "@/lib/db/schema";
import { logAdminAudit } from "@/lib/admin-audit";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";

type Operation = "freeze_evaluation" | "unfreeze_evaluation" | "reopen_evaluation" | "freeze_submission" | "reassign" | "remove_assignment" | "set_conflict";

async function postJudging(
  request: NextRequest,
  _context: unknown,
  authorization: AdminApiAuthorization,
) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "A JSON operation is required." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid operation." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const operation = input.operation as Operation;
  const assignmentId = typeof input.assignmentId === "string" ? input.assignmentId : null;
  const actorId = authorization.session?.local_user_id ?? null;
  if (!assignmentId || !["freeze_evaluation", "unfreeze_evaluation", "reopen_evaluation", "freeze_submission", "reassign", "remove_assignment", "set_conflict"].includes(operation)) {
    return NextResponse.json({ error: "A supported operation and assignmentId are required." }, { status: 400 });
  }
  const assignment = (await db.select().from(judgeAssignments).where(eq(judgeAssignments.id, assignmentId)).limit(1))[0];
  if (!assignment) return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  const now = new Date();
  const assignmentState = (await db.select().from(judgingAssignmentStates).where(eq(judgingAssignmentStates.assignmentId, assignmentId)).limit(1))[0];
  if (!assignmentState) await db.insert(judgingAssignmentStates).values({ id: `jas_${nanoid(12)}`, assignmentId, status: "active", createdAt: now, updatedAt: now });

  if (operation === "freeze_submission") {
    const submissionAssignments = await db.select({ id: judgeAssignments.id }).from(judgeAssignments).leftJoin(judgingAssignmentStates, eq(judgingAssignmentStates.assignmentId, judgeAssignments.id)).where(and(eq(judgeAssignments.submissionId, assignment.submissionId), eq(judgingAssignmentStates.status, "active")));
    for (const row of submissionAssignments) {
      const existing = (await db.select().from(judgingEvaluationStates).where(eq(judgingEvaluationStates.assignmentId, row.id)).limit(1))[0];
      if (existing) await db.update(judgingEvaluationStates).set({ status: "frozen", frozenAt: now, changedByUserId: actorId, changedAt: now, updatedAt: now }).where(eq(judgingEvaluationStates.assignmentId, row.id));
      else await db.insert(judgingEvaluationStates).values({ id: `jes_${nanoid(12)}`, assignmentId: row.id, status: "frozen", frozenAt: now, changedByUserId: actorId, changedAt: now, createdAt: now, updatedAt: now });
    }
    await logAdminAudit("admin_judging_evaluation_frozen", { actor_id: actorId, assignment_id: assignmentId, submission_id: assignment.submissionId, operation: "freeze_submission", next_status: "frozen" });
    return NextResponse.json({ success: true, status: "frozen", affected: submissionAssignments.length });
  }

  if (operation === "freeze_evaluation" || operation === "unfreeze_evaluation" || operation === "reopen_evaluation") {
    const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 240) : "";
    if (operation === "reopen_evaluation" && reason.length < 3) return NextResponse.json({ error: "A reason is required to reopen an evaluation." }, { status: 400 });
    const current = (await db.select().from(judgingEvaluationStates).where(eq(judgingEvaluationStates.assignmentId, assignmentId)).limit(1))[0];
    if (operation === "freeze_evaluation" && current?.status === "frozen") return NextResponse.json({ success: true, idempotent: true });
    if (operation === "freeze_evaluation" && current?.status !== "submitted") return NextResponse.json({ error: "Only a submitted evaluation can be frozen." }, { status: 409 });
    if ((operation === "reopen_evaluation" || operation === "unfreeze_evaluation") && !current) return NextResponse.json({ error: "Evaluation state not found." }, { status: 409 });
    const nextStatus = operation === "freeze_evaluation" ? "frozen" : "reopened";
    if (current) {
      await db.update(judgingEvaluationStates).set({ status: nextStatus, reason: reason || current.reason, frozenAt: operation === "freeze_evaluation" ? now : current.frozenAt, reopenedAt: operation === "reopen_evaluation" ? now : current.reopenedAt, changedByUserId: actorId, changedAt: now, updatedAt: now }).where(eq(judgingEvaluationStates.assignmentId, assignmentId));
    } else {
      await db.insert(judgingEvaluationStates).values({ id: `jes_${nanoid(12)}`, assignmentId, status: nextStatus, reason: reason || null, frozenAt: operation === "freeze_evaluation" ? now : null, reopenedAt: operation === "reopen_evaluation" ? now : null, changedByUserId: actorId, changedAt: now, createdAt: now, updatedAt: now });
    }
    await logAdminAudit(operation === "freeze_evaluation" ? "admin_judging_evaluation_frozen" : "admin_judging_evaluation_reopened", { actor_id: actorId, assignment_id: assignmentId, submission_id: assignment.submissionId, judge_id: assignment.judgeId, reason: reason || null, previous_status: current?.status ?? "not_started", next_status: nextStatus, operation });
    return NextResponse.json({ success: true, status: nextStatus });
  }

  if (operation === "remove_assignment") {
    if (assignmentState?.status === "removed") return NextResponse.json({ success: true, idempotent: true });
    await db.update(judgingAssignmentStates).set({ status: "removed", reason: typeof input.reason === "string" ? input.reason.trim().slice(0, 240) : "Removed by administrator", changedByUserId: actorId, changedAt: now, updatedAt: now }).where(eq(judgingAssignmentStates.assignmentId, assignmentId));
    await logAdminAudit("admin_judging_assignment_removed", { actor_id: actorId, assignment_id: assignmentId, submission_id: assignment.submissionId, judge_id: assignment.judgeId, next_status: "removed" });
    return NextResponse.json({ success: true, status: "removed" });
  }

  if (operation === "set_conflict") {
    const conflictStatus = input.conflictStatus;
    if (!["clear", "declared", "recused", "withdrawn", "replacement_required"].includes(String(conflictStatus))) return NextResponse.json({ error: "Invalid conflict status." }, { status: 400 });
    await db.update(judgingAssignmentStates).set({ conflictStatus: String(conflictStatus) as "clear", changedByUserId: actorId, changedAt: now, updatedAt: now }).where(eq(judgingAssignmentStates.assignmentId, assignmentId));
    await logAdminAudit("admin_judging_assignment_conflict_updated", { actor_id: actorId, assignment_id: assignmentId, submission_id: assignment.submissionId, judge_id: assignment.judgeId, next_status: String(conflictStatus) });
    return NextResponse.json({ success: true, conflictStatus });
  }

  const replacementJudgeId = typeof input.replacementJudgeId === "string" ? input.replacementJudgeId : null;
  if (!replacementJudgeId || replacementJudgeId === assignment.judgeId) return NextResponse.json({ error: "Choose a different replacement judge." }, { status: 400 });
  const existing = (await db.select().from(judgeAssignments).where(and(eq(judgeAssignments.judgeId, replacementJudgeId), eq(judgeAssignments.submissionId, assignment.submissionId))).limit(1))[0];
  if (existing) return NextResponse.json({ error: "That judge already has an assignment for this submission." }, { status: 409 });
  const replacementId = `ja_${nanoid(12)}`;
  db.transaction((tx: DB) => {
    tx.update(judgingAssignmentStates).set({ status: "superseded", replacementAssignmentId: replacementId, changedByUserId: actorId, changedAt: now, updatedAt: now }).where(eq(judgingAssignmentStates.assignmentId, assignmentId)).run();
    tx.insert(judgeAssignments).values({ id: replacementId, judgeId: replacementJudgeId, submissionId: assignment.submissionId, createdAt: now }).run();
    tx.insert(judgingAssignmentStates).values({ id: `jas_${nanoid(12)}`, assignmentId: replacementId, status: "active", createdAt: now, updatedAt: now }).run();
    tx.insert(judgingEvaluationStates).values({ id: `jes_${nanoid(12)}`, assignmentId: replacementId, status: "not_started", createdAt: now, updatedAt: now }).run();
  });
  await logAdminAudit("admin_judging_assignment_reassigned", { actor_id: actorId, assignment_id: assignmentId, replacement_judge_id: replacementJudgeId, submission_id: assignment.submissionId, judge_id: assignment.judgeId, next_status: "superseded" });
  return NextResponse.json({ success: true, replacementAssignmentId: replacementId });
}

export const POST = withAdminApi("POST /api/admin/judging", postJudging);
