import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";
import { logAdminAudit } from "@/lib/admin-audit";
import { calibrationConsensusReviews, calibrationThresholds, submissions } from "@/lib/db/schema";

type Operation = "start_consensus" | "add_consensus_note" | "complete_consensus" | "reopen_consensus" | "flag_consensus" | "update_thresholds";

async function postCalibration(request: NextRequest, _context: unknown, authorization: AdminApiAuthorization) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "A JSON operation is required." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid operation." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const operation = input.operation as Operation;
  const event = await getActiveEvent();
  if (!event) return NextResponse.json({ error: "No active event is configured." }, { status: 409 });
  const actorUserId = authorization.session?.local_user_id ?? null;
  const now = new Date();
  const submissionId = typeof input.submissionId === "string" ? input.submissionId.trim() : "";
  if (submissionId) {
    const exists = (await db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.id, submissionId), eq(submissions.eventId, event.id))).limit(1))[0];
    if (!exists) return NextResponse.json({ error: "That project is not part of the active event." }, { status: 404 });
  }
  if (operation === "update_thresholds") {
    const overallVariance = typeof input.overallVariance === "number" ? input.overallVariance : null;
    const criterionVariance = typeof input.criterionVariance === "number" ? input.criterionVariance : null;
    const outlierDifference = typeof input.outlierDifference === "number" ? input.outlierDifference : null;
    const minimumEvaluations = typeof input.minimumEvaluations === "number" ? input.minimumEvaluations : null;
    if (overallVariance === null || criterionVariance === null || outlierDifference === null || minimumEvaluations === null || overallVariance <= 0 || criterionVariance <= 0 || outlierDifference <= 0 || minimumEvaluations < 2 || minimumEvaluations > 20) return NextResponse.json({ error: "Thresholds must be positive and require at least two evaluations." }, { status: 400 });
    const current = (await db.select().from(calibrationThresholds).where(eq(calibrationThresholds.eventId, event.id)).limit(1))[0];
    const values = { overallVarianceThreshold: overallVariance, criterionVarianceThreshold: criterionVariance, outlierDifferenceThreshold: outlierDifference, minimumEvaluations, updatedByUserId: actorUserId, updatedAt: now };
    if (current) await db.update(calibrationThresholds).set(values).where(eq(calibrationThresholds.id, current.id));
    else await db.insert(calibrationThresholds).values({ id: `ct_${event.id}`, eventId: event.id, ...values });
    await logAdminAudit("admin_calibration_threshold_changed", { actor_id: actorUserId, operation, threshold_type: "event", threshold_value: overallVariance, previous_status: current ? "configured" : "default", next_status: "configured" });
    return NextResponse.json({ success: true });
  }
  if (!submissionId) return NextResponse.json({ error: "A project is required." }, { status: 400 });
  const existing = (await db.select().from(calibrationConsensusReviews).where(and(eq(calibrationConsensusReviews.eventId, event.id), eq(calibrationConsensusReviews.submissionId, submissionId))).limit(1))[0];
  if (operation === "start_consensus") {
    if (existing) {
      if (existing.status === "in_review") return NextResponse.json({ success: true, status: existing.status, idempotent: true });
      await db.update(calibrationConsensusReviews).set({ status: "in_review", actorUserId, updatedAt: now, completedAt: null }).where(eq(calibrationConsensusReviews.id, existing.id));
      await logAdminAudit("admin_calibration_consensus_reopened", { actor_id: actorUserId, submission_id: submissionId, consensus_id: existing.id, previous_status: existing.status, next_status: "in_review", operation });
      return NextResponse.json({ success: true, status: "in_review" });
    }
    const id = `ccr_${nanoid(12)}`;
    await db.insert(calibrationConsensusReviews).values({ id, eventId: event.id, submissionId, status: "in_review", actorUserId, startedAt: now, createdAt: now, updatedAt: now });
    await logAdminAudit("admin_calibration_consensus_started", { actor_id: actorUserId, submission_id: submissionId, consensus_id: id, previous_status: "suggested", next_status: "in_review", operation });
    return NextResponse.json({ success: true, status: "in_review" });
  }
  if (!existing) return NextResponse.json({ error: "Start the consensus review first." }, { status: 409 });
  if (operation === "add_consensus_note") {
    const note = typeof input.note === "string" ? input.note.trim().slice(0, 1000) : "";
    if (note.length < 3) return NextResponse.json({ error: "A short discussion note is required." }, { status: 400 });
    const discussion = existing.discussion ? `${existing.discussion}\n${note}`.slice(-4000) : note;
    await db.update(calibrationConsensusReviews).set({ discussion, actorUserId, updatedAt: now }).where(eq(calibrationConsensusReviews.id, existing.id));
    await logAdminAudit("admin_calibration_note_added", { actor_id: actorUserId, submission_id: submissionId, consensus_id: existing.id, operation, note_length: note.length });
    return NextResponse.json({ success: true });
  }
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 300) : "";
  if (operation === "reopen_consensus" || operation === "flag_consensus") {
    if (reason.length < 3) return NextResponse.json({ error: "A reason is required." }, { status: 400 });
    const nextStatus = operation === "flag_consensus" ? "flagged" : "in_review";
    await db.update(calibrationConsensusReviews).set({ status: nextStatus, flaggedReason: operation === "flag_consensus" ? reason : null, completedAt: null, actorUserId, updatedAt: now }).where(eq(calibrationConsensusReviews.id, existing.id));
    await logAdminAudit(operation === "flag_consensus" ? "admin_calibration_flagged" : "admin_calibration_consensus_reopened", { actor_id: actorUserId, submission_id: submissionId, consensus_id: existing.id, previous_status: existing.status, next_status: nextStatus, reason, operation });
    return NextResponse.json({ success: true, status: nextStatus });
  }
  if (operation === "complete_consensus") {
    await db.update(calibrationConsensusReviews).set({ status: "complete", actorUserId, completedAt: now, updatedAt: now }).where(eq(calibrationConsensusReviews.id, existing.id));
    await logAdminAudit("admin_calibration_consensus_completed", { actor_id: actorUserId, submission_id: submissionId, consensus_id: existing.id, previous_status: existing.status, next_status: "complete", operation });
    return NextResponse.json({ success: true, status: "complete" });
  }
  return NextResponse.json({ error: "Unsupported calibration operation." }, { status: 400 });
}

export const POST = withAdminApi("POST /api/admin/calibration", postCalibration);
