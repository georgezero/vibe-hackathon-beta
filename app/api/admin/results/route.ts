import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import {
  events,
  resultFinalists,
  resultPublicationStates,
  resultTieReviewSubmissions,
  resultTieReviews,
  resultWinners,
  submissions,
} from "@/lib/db/schema";
import { logAdminAudit } from "@/lib/admin-audit";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";
import { getResultsData } from "@/lib/results";

type Operation = "review_tie" | "add_finalist" | "remove_finalist" | "bulk_add_finalists" | "assign_winner" | "remove_winner" | "mark_reviewed" | "publish" | "unpublish";
const categories = new Set(["grand_prize", "runner_up", "honorable_mention", "custom"]);

async function postResults(request: NextRequest, _context: unknown, authorization: AdminApiAuthorization) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "A JSON operation is required." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid operation." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const operation = input.operation as Operation;
  const event = await getActiveEvent();
  if (!event) return NextResponse.json({ error: "No active event is configured." }, { status: 409 });
  const actorUserId = authorization.session?.local_user_id ?? null;
  const now = new Date();
  const calculatedResults = operation === "add_finalist" || operation === "bulk_add_finalists" ? await getResultsData(event.id) : null;

  if (operation === "review_tie") {
    const tieKey = typeof input.tieKey === "string" ? input.tieKey.trim().slice(0, 120) : "";
    const rationale = typeof input.rationale === "string" ? input.rationale.trim().slice(0, 500) : "";
    const submissionIds = Array.isArray(input.submissionIds) ? input.submissionIds.filter((id): id is string => typeof id === "string").slice(0, 20) : [];
    if (!tieKey || submissionIds.length < 2 || rationale.length < 3) return NextResponse.json({ error: "Tie key, two projects, and a rationale are required." }, { status: 400 });
    const validSubmissions = await db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.eventId, event.id)));
    const validIds = new Set(validSubmissions.map((submission: { id: string }) => submission.id));
    if (submissionIds.some((submissionId) => !validIds.has(submissionId))) return NextResponse.json({ error: "Every tie project must belong to the active event." }, { status: 400 });
    const score = typeof input.score === "number" && Number.isFinite(input.score) ? input.score : null;
    const existing = (await db.select().from(resultTieReviews).where(and(eq(resultTieReviews.eventId, event.id), eq(resultTieReviews.tieKey, tieKey))).limit(1))[0];
    let reviewId = existing?.id;
    if (existing) {
      await db.update(resultTieReviews).set({ status: "resolved", rationale, resolvedByUserId: actorUserId, resolvedAt: now, updatedAt: now }).where(eq(resultTieReviews.id, existing.id));
    } else {
      reviewId = `rtr_${nanoid(12)}`;
      await db.insert(resultTieReviews).values({ id: reviewId, eventId: event.id, tieKey, status: "resolved", rationale, resolvedByUserId: actorUserId, resolvedAt: now, createdAt: now, updatedAt: now });
    }
    if (reviewId) {
      for (const submissionId of submissionIds) {
        const member = (await db.select().from(resultTieReviewSubmissions).where(and(eq(resultTieReviewSubmissions.tieReviewId, reviewId), eq(resultTieReviewSubmissions.submissionId, submissionId))).limit(1))[0];
        if (!member) await db.insert(resultTieReviewSubmissions).values({ id: `rtrs_${nanoid(12)}`, tieReviewId: reviewId, submissionId, score: score ?? 0, createdAt: now });
      }
    }
    await logAdminAudit("admin_results_tie_reviewed", { actor_id: actorUserId, submission_id: submissionIds[0], tie_key: tieKey, operation: "review_tie", result_status: "resolved", reason: rationale });
    return NextResponse.json({ success: true, status: "resolved" });
  }

  if (operation === "bulk_add_finalists") {
    const submissionIds = Array.isArray(input.submissionIds) ? input.submissionIds.filter((id): id is string => typeof id === "string").slice(0, 50) : [];
    if (!submissionIds.length) return NextResponse.json({ error: "Select at least one ranked project." }, { status: 400 });
    const valid = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.eventId, event.id));
    const validIds = new Set(valid.map((submission: { id: string }) => submission.id));
    if (submissionIds.some((submissionId) => !validIds.has(submissionId))) return NextResponse.json({ error: "Every selected project must belong to the active event." }, { status: 400 });
    if (submissionIds.some((submissionId) => calculatedResults?.rows.find((row) => row.submissionId === submissionId)?.incomplete !== false)) return NextResponse.json({ error: "Only ranked projects can become finalists." }, { status: 409 });
    for (const submissionId of submissionIds) {
      const existing = (await db.select({ id: resultFinalists.id }).from(resultFinalists).where(and(eq(resultFinalists.eventId, event.id), eq(resultFinalists.submissionId, submissionId), eq(resultFinalists.status, "active"))).limit(1))[0];
      if (!existing) {
        await db.insert(resultFinalists).values({ id: `rf_${nanoid(12)}`, eventId: event.id, submissionId, status: "active", actorUserId, reason: "Bulk finalist selection", createdAt: now, updatedAt: now });
        await logAdminAudit("admin_results_finalist_added", { actor_id: actorUserId, submission_id: submissionId, operation, idempotent: false });
      }
    }
    return NextResponse.json({ success: true, count: submissionIds.length });
  }

  if (operation === "add_finalist" || operation === "remove_finalist") {
    const submissionId = typeof input.submissionId === "string" ? input.submissionId : "";
    if (!submissionId) return NextResponse.json({ error: "submissionId is required." }, { status: 400 });
    const sub = (await db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.id, submissionId), eq(submissions.eventId, event.id))).limit(1))[0];
    if (!sub) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    if (operation === "add_finalist" && calculatedResults?.rows.find((row) => row.submissionId === submissionId)?.incomplete !== false) return NextResponse.json({ error: "Only ranked projects can become finalists." }, { status: 409 });
    const existing = (await db.select().from(resultFinalists).where(and(eq(resultFinalists.eventId, event.id), eq(resultFinalists.submissionId, submissionId), eq(resultFinalists.status, "active"))).limit(1))[0];
    if (operation === "add_finalist" && !existing) await db.insert(resultFinalists).values({ id: `rf_${nanoid(12)}`, eventId: event.id, submissionId, status: "active", actorUserId, reason: typeof input.reason === "string" ? input.reason.trim().slice(0, 240) : null, createdAt: now, updatedAt: now });
    if (operation === "remove_finalist" && existing) await db.update(resultFinalists).set({ status: "removed", actorUserId, reason: typeof input.reason === "string" ? input.reason.trim().slice(0, 240) : "Removed by administrator", updatedAt: now }).where(eq(resultFinalists.id, existing.id));
    await logAdminAudit(operation === "add_finalist" ? "admin_results_finalist_added" : "admin_results_finalist_removed", { actor_id: actorUserId, submission_id: submissionId, operation, idempotent: operation === "add_finalist" ? Boolean(existing) : !existing });
    return NextResponse.json({ success: true, idempotent: operation === "add_finalist" ? Boolean(existing) : !existing });
  }

  if (operation === "assign_winner" || operation === "remove_winner") {
    const submissionId = typeof input.submissionId === "string" ? input.submissionId : "";
    const category = typeof input.category === "string" ? input.category : "";
    if (!submissionId || !categories.has(category)) return NextResponse.json({ error: "submissionId and a valid award category are required." }, { status: 400 });
    if (category === "custom" && (typeof input.awardLabel !== "string" || input.awardLabel.trim().length < 2)) return NextResponse.json({ error: "Custom awards require a label." }, { status: 400 });
    const sub = (await db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.id, submissionId), eq(submissions.eventId, event.id))).limit(1))[0];
    if (!sub) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    const existing = (await db.select().from(resultWinners).where(and(eq(resultWinners.eventId, event.id), eq(resultWinners.category, category as "custom"), eq(resultWinners.status, "active"))).limit(1))[0];
    if (operation === "assign_winner") {
      if (existing && existing.submissionId !== submissionId) return NextResponse.json({ error: "That award category is already assigned." }, { status: 409 });
      if (!existing) await db.insert(resultWinners).values({ id: `rw_${nanoid(12)}`, eventId: event.id, submissionId, category: category as "grand_prize", awardLabel: category === "custom" ? String(input.awardLabel).trim().slice(0, 120) : null, status: "active", actorUserId, reason: typeof input.reason === "string" ? input.reason.trim().slice(0, 240) : null, createdAt: now, updatedAt: now });
    } else if (existing) {
      await db.update(resultWinners).set({ status: "removed", actorUserId, reason: typeof input.reason === "string" ? input.reason.trim().slice(0, 240) : "Removed by administrator", updatedAt: now }).where(eq(resultWinners.id, existing.id));
    }
    await logAdminAudit(operation === "assign_winner" ? "admin_results_winner_assigned" : "admin_results_winner_removed", { actor_id: actorUserId, submission_id: submissionId, category, operation, idempotent: operation === "assign_winner" ? Boolean(existing) : !existing });
    return NextResponse.json({ success: true, idempotent: operation === "assign_winner" ? Boolean(existing) : !existing });
  }

  const current = (await db.select().from(resultPublicationStates).where(eq(resultPublicationStates.eventId, event.id)).limit(1))[0];
  if (!current) return NextResponse.json({ error: "Results migration is required before publication operations." }, { status: 409 });
  if (operation === "mark_reviewed") {
    await db.update(resultPublicationStates).set({ status: "reviewed", actorUserId, publishedAt: null, updatedAt: now }).where(eq(resultPublicationStates.id, current.id));
    return NextResponse.json({ success: true, status: "reviewed" });
  }
  if (operation === "publish") {
    if (current.status !== "reviewed") return NextResponse.json({ error: "Results must be marked reviewed before publication." }, { status: 409 });
    const activeWinners = await db.select({ id: resultWinners.id }).from(resultWinners).where(and(eq(resultWinners.eventId, event.id), eq(resultWinners.status, "active")));
    if (activeWinners.length === 0) return NextResponse.json({ error: "Assign at least one winner before publishing results." }, { status: 409 });
    await db.update(resultPublicationStates).set({ status: "published", actorUserId, publishedAt: now, updatedAt: now }).where(eq(resultPublicationStates.id, current.id));
    await db.update(events).set({ winnersPublishedAt: now, updatedAt: now }).where(eq(events.id, event.id));
    await logAdminAudit("admin_results_published", { actor_id: actorUserId, operation, publication_status: "published" });
    return NextResponse.json({ success: true, status: "published" });
  }
  if (operation === "unpublish") {
    await db.update(resultPublicationStates).set({ status: "reviewed", actorUserId, publishedAt: null, updatedAt: now }).where(eq(resultPublicationStates.id, current.id));
    await db.update(events).set({ winnersPublishedAt: null, updatedAt: now }).where(eq(events.id, event.id));
    await logAdminAudit("admin_results_unpublished", { actor_id: actorUserId, operation, publication_status: "reviewed" });
    return NextResponse.json({ success: true, status: "reviewed" });
  }
  return NextResponse.json({ error: "Unsupported results operation." }, { status: 400 });
}

export const POST = withAdminApi("POST /api/admin/results", postResults);
