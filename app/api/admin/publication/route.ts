import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { getActiveEvent } from "@/lib/events";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";
import { logAdminAudit } from "@/lib/admin-audit";
import { getPublicationData, PUBLICATION_AWARD_CATEGORIES, type PublicationMode } from "@/lib/publication";
import { isPublicationQualificationEnabled, isPublicationQualificationSubmission } from "@/lib/publication-qualification";
import { events, publicationAnnouncements, publicationAwards, publicationFeedback, publicationFeedbackComments, publicationQualificationAnnouncements, publicationQualificationReleases, publicationQualificationRevisions, publicationReleases, publicationRevisions, submissions } from "@/lib/db/schema";

type Operation = "review" | "approve" | "publish" | "archive" | "withdraw" | "update_mode" | "assign_award" | "remove_award" | "save_feedback" | "add_feedback_comment" | "set_feedback_status" | "save_announcement" | "set_announcement_status";
const modes = new Set(["awards_only", "awards_feedback", "feedback_later", "everything"]);
const feedbackStatuses = new Set(["draft", "released", "withdrawn"]);
const announcementStatuses = new Set(["draft", "published", "withdrawn"]);

async function ensureRelease(eventId: string) {
  const existing = (await db.select().from(publicationReleases).where(eq(publicationReleases.eventId, eventId)).limit(1))[0];
  if (existing) return existing;
  const id = `pr_${eventId}`;
  await db.insert(publicationReleases).values({ id, eventId, status: "calculated", publicationMode: "awards_only", showScores: true, updatedAt: new Date() });
  return (await db.select().from(publicationReleases).where(eq(publicationReleases.id, id)).limit(1))[0];
}

async function ensureQualificationRelease(eventId: string, submissionId: string) {
  const existing = (await db.select().from(publicationQualificationReleases).where(and(eq(publicationQualificationReleases.eventId, eventId), eq(publicationQualificationReleases.submissionId, submissionId))).limit(1))[0];
  if (existing) return existing;
  const now = new Date();
  const id = `pqr_${eventId}_${submissionId}`;
  await db.insert(publicationQualificationReleases).values({ id, eventId, submissionId, fixtureMarker: "d4-publication-qualification", status: "calculated", publicationMode: "awards_only", showScores: false, updatedAt: now });
  await db.insert(publicationQualificationRevisions).values({ id: `${id}_rev_1`, releaseId: id, eventId, submissionId, revision: 1, status: "calculated", publicationMode: "awards_only", showScores: false, reason: "qualification fixture initialized", createdAt: now });
  return (await db.select().from(publicationQualificationReleases).where(eq(publicationQualificationReleases.id, id)).limit(1))[0];
}

async function recordRevision(release: typeof publicationReleases.$inferSelect, actorUserId: string | null, reason: string | null, now: Date) {
  const latest = (await db.select({ revision: publicationRevisions.revision }).from(publicationRevisions).where(eq(publicationRevisions.releaseId, release.id)).orderBy(desc(publicationRevisions.revision)).limit(1))[0];
  const revision = (latest?.revision ?? 0) + 1;
  await db.insert(publicationRevisions).values({ id: `pvr_${release.id}_${revision}`, releaseId: release.id, eventId: release.eventId, revision, status: release.status, publicationMode: release.publicationMode, showScores: release.showScores, actorUserId, reason, createdAt: now });
  return revision;
}

async function recordQualificationRevision(release: typeof publicationQualificationReleases.$inferSelect, actorUserId: string | null, reason: string | null, now: Date) {
  const latest = (await db.select({ revision: publicationQualificationRevisions.revision }).from(publicationQualificationRevisions).where(eq(publicationQualificationRevisions.releaseId, release.id)).orderBy(desc(publicationQualificationRevisions.revision)).limit(1))[0];
  const revision = (latest?.revision ?? 0) + 1;
  await db.insert(publicationQualificationRevisions).values({ id: `pqr_${release.id}_${revision}`, releaseId: release.id, eventId: release.eventId, submissionId: release.submissionId, revision, status: release.status, publicationMode: release.publicationMode, showScores: release.showScores, actorUserId, reason, createdAt: now });
  return revision;
}

async function postPublication(request: NextRequest, _context: unknown, authorization: AdminApiAuthorization) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "A JSON operation is required." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid operation." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const operation = input.operation as Operation;
  const event = await getActiveEvent();
  if (!event) return NextResponse.json({ error: "No active event is configured." }, { status: 409 });
  const actorUserId = authorization.session?.local_user_id ?? null;
  const now = new Date();
  const eventRelease = await ensureRelease(event.id);
  if (!eventRelease) return NextResponse.json({ error: "Publication state is unavailable." }, { status: 503 });
  const submissionId = typeof input.submissionId === "string" ? input.submissionId.trim() : "";
  const validSubmission = submissionId ? (await db.select({ id: submissions.id }).from(submissions).where(and(eq(submissions.id, submissionId), eq(submissions.eventId, event.id))).limit(1))[0] : null;
  if (submissionId && !validSubmission) return NextResponse.json({ error: "That project is not part of the active event." }, { status: 404 });
  const qualificationMode = isPublicationQualificationEnabled();
  if (qualificationMode && (!submissionId || !isPublicationQualificationSubmission(submissionId))) return NextResponse.json({ error: "Qualification mode requires the exact approved synthetic submission." }, { status: 409 });
  const qualificationRelease = qualificationMode ? await ensureQualificationRelease(event.id, submissionId) : null;
  const release = qualificationRelease ?? eventRelease;

  if (["review", "approve", "publish", "archive", "withdraw"].includes(operation)) {
    const transition: Record<string, { from: string[]; to: "reviewed" | "approved" | "published" | "archived" | "reviewed" }> = {
      review: { from: ["calculated"], to: "reviewed" },
      approve: { from: ["reviewed"], to: "approved" },
      publish: { from: ["approved"], to: "published" },
      archive: { from: ["published"], to: "archived" },
      withdraw: { from: ["published", "archived", "approved"], to: "reviewed" },
    };
    const rule = transition[operation];
    if (!rule.from.includes(release.status)) {
      if (release.status === rule.to) return NextResponse.json({ success: true, status: release.status, idempotent: true });
      return NextResponse.json({ error: `Publication is ${release.status}; that transition is not available.` }, { status: 409 });
    }
    const values = { status: rule.to, actorUserId, updatedAt: now, ...(rule.to === "approved" ? { approvedAt: now } : {}), ...(rule.to === "published" ? { publishedAt: now } : {}), ...(rule.to === "archived" ? { archivedAt: now } : {}), ...(operation === "withdraw" ? { publishedAt: null, approvedAt: null } : {}) };
    if (qualificationRelease) await db.update(publicationQualificationReleases).set(values).where(eq(publicationQualificationReleases.id, release.id));
    else await db.update(publicationReleases).set(values).where(eq(publicationReleases.id, release.id));
    const nextRelease = { ...release, ...values, status: rule.to, actorUserId, updatedAt: now };
    if (qualificationRelease) await recordQualificationRevision(nextRelease, actorUserId, `qualification publication ${operation}`, now);
    else await recordRevision(nextRelease, actorUserId, `publication ${operation}`, now);
    if (operation === "publish" && !qualificationRelease) {
      await db.update(events).set({ winnersPublishedAt: now, updatedAt: now }).where(eq(events.id, event.id));
    }
    if (operation === "withdraw" && !qualificationRelease) {
      await db.update(events).set({ winnersPublishedAt: null, updatedAt: now }).where(eq(events.id, event.id));
    }
    const action = operation === "review" ? "admin_publication_reviewed" : operation === "publish" ? "admin_publication_released" : operation === "withdraw" ? "admin_publication_withdrawn" : operation === "archive" ? "admin_publication_archived" : "admin_publication_approved";
    await logAdminAudit(action, { actor_id: actorUserId, release_id: release.id, operation, previous_status: release.status, next_status: rule.to, publication_mode: release.publicationMode });
    return NextResponse.json({ success: true, status: rule.to });
  }
  if (operation === "update_mode") {
    const mode = typeof input.publicationMode === "string" ? input.publicationMode : "";
    if (!modes.has(mode) || release.status === "archived") return NextResponse.json({ error: "That publication mode is not available." }, { status: 400 });
    const showScores = input.showScores !== false;
    const publicationChanged = release.publicationMode !== mode || release.showScores !== showScores;
    if (!publicationChanged) return NextResponse.json({ success: true, idempotent: true });
    if ((release.status === "published" || release.status === "archived") && input.confirmRevision !== true) return NextResponse.json({ error: "Changing published visibility requires an explicit revision confirmation." }, { status: 409 });
    const modeValues = { publicationMode: mode as PublicationMode, showScores, actorUserId, updatedAt: now };
    if (qualificationRelease) await db.update(publicationQualificationReleases).set(modeValues).where(eq(publicationQualificationReleases.id, release.id));
    else await db.update(publicationReleases).set(modeValues).where(eq(publicationReleases.id, release.id));
    if (release.status === "published" || release.status === "archived") {
      const revisionRelease = { ...release, ...modeValues };
      if (qualificationRelease) await recordQualificationRevision(revisionRelease, actorUserId, typeof input.reason === "string" ? input.reason.slice(0, 240) : "qualification publication options changed", now);
      else await recordRevision(revisionRelease, actorUserId, typeof input.reason === "string" ? input.reason.slice(0, 240) : "publication options changed", now);
    }
    await logAdminAudit("admin_publication_mode_changed", { actor_id: actorUserId, release_id: release.id, operation, publication_mode: mode, show_scores: showScores });
    return NextResponse.json({ success: true });
  }
  if (operation === "assign_award") {
    if (!submissionId) return NextResponse.json({ error: "A project is required." }, { status: 400 });
    const publicationData = await getPublicationData(event.id);
    const ranked = publicationData.rows.find((row) => row.submissionId === submissionId && row.rank !== null);
    if (!ranked) return NextResponse.json({ error: "Only a ranked, complete project can receive a publication award." }, { status: 409 });
    const category = typeof input.category === "string" ? input.category : "";
    const categoryEntry = PUBLICATION_AWARD_CATEGORIES.find(([key]) => key === category);
    const customLabel = typeof input.label === "string" ? input.label.trim().slice(0, 120) : "";
    if (!categoryEntry || (category === "custom" && customLabel.length < 3)) return NextResponse.json({ error: "Choose a supported award category." }, { status: 400 });
    const label = category === "custom" ? customLabel : categoryEntry[1];
    const existing = (await db.select().from(publicationAwards).where(and(eq(publicationAwards.eventId, event.id), eq(publicationAwards.category, category), eq(publicationAwards.status, "active"))).limit(1))[0];
    if (existing && existing.submissionId !== submissionId) return NextResponse.json({ error: "That award category is already assigned outside the qualification fixture." }, { status: 409 });
    if (existing) await db.update(publicationAwards).set({ submissionId, label, actorUserId, updatedAt: now }).where(eq(publicationAwards.id, existing.id));
    else await db.insert(publicationAwards).values({ id: `pa_${nanoid(12)}`, eventId: event.id, submissionId, category, label, status: "active", actorUserId, createdAt: now, updatedAt: now });
    await logAdminAudit("admin_publication_award_assigned", { actor_id: actorUserId, submission_id: submissionId, category, operation });
    return NextResponse.json({ success: true });
  }
  if (operation === "remove_award") {
    const awardId = typeof input.awardId === "string" ? input.awardId : "";
    if (!awardId) return NextResponse.json({ error: "An award is required." }, { status: 400 });
    const existing = (await db.select({ id: publicationAwards.id }).from(publicationAwards).where(and(eq(publicationAwards.id, awardId), eq(publicationAwards.eventId, event.id), eq(publicationAwards.status, "active"))).limit(1))[0];
    if (!existing) return NextResponse.json({ error: "That award is no longer active." }, { status: 404 });
    if (qualificationRelease) {
      const scoped = (await db.select({ submissionId: publicationAwards.submissionId }).from(publicationAwards).where(eq(publicationAwards.id, awardId)).limit(1))[0];
      if (scoped?.submissionId !== submissionId) return NextResponse.json({ error: "Only the approved synthetic award can be changed in qualification mode." }, { status: 409 });
    }
    await db.update(publicationAwards).set({ status: "removed", actorUserId, updatedAt: now }).where(eq(publicationAwards.id, awardId));
    await logAdminAudit("admin_publication_award_removed", { actor_id: actorUserId, award_id: awardId, operation });
    return NextResponse.json({ success: true });
  }
  if (operation === "save_feedback" || operation === "add_feedback_comment" || operation === "set_feedback_status") {
    if (!submissionId) return NextResponse.json({ error: "A project is required." }, { status: 400 });
    const current = (await db.select().from(publicationFeedback).where(and(eq(publicationFeedback.eventId, event.id), eq(publicationFeedback.submissionId, submissionId))).limit(1))[0];
    const feedbackId = current?.id ?? `pf_${nanoid(12)}`;
    if (!current) await db.insert(publicationFeedback).values({ id: feedbackId, eventId: event.id, submissionId, status: "draft", actorUserId, createdAt: now, updatedAt: now });
    if (operation === "save_feedback") {
      const summary = typeof input.summary === "string" ? input.summary.trim().slice(0, 2000) : "";
      await db.update(publicationFeedback).set({ administratorSummary: summary || null, actorUserId, updatedAt: now }).where(eq(publicationFeedback.id, feedbackId));
    } else if (operation === "add_feedback_comment") {
      const comment = typeof input.comment === "string" ? input.comment.trim().slice(0, 1000) : "";
      if (comment.length < 3) return NextResponse.json({ error: "A feedback comment is required." }, { status: 400 });
      await db.insert(publicationFeedbackComments).values({ id: `pfc_${nanoid(12)}`, feedbackId, comment, status: "draft", actorUserId, createdAt: now, updatedAt: now });
    } else {
      const status = typeof input.status === "string" ? input.status : "";
      if (!feedbackStatuses.has(status)) return NextResponse.json({ error: "Invalid feedback state." }, { status: 400 });
      if (status === "released" && release.status !== "published" && release.status !== "archived") return NextResponse.json({ error: "Publish results before releasing feedback." }, { status: 409 });
      await db.update(publicationFeedback).set({ status: status as "draft", releasedAt: status === "released" ? now : null, actorUserId, updatedAt: now }).where(eq(publicationFeedback.id, feedbackId));
      await db.update(publicationFeedbackComments).set({ status: status === "released" ? "released" : status === "withdrawn" ? "withdrawn" : "draft", releasedAt: status === "released" ? now : null, actorUserId, updatedAt: now }).where(eq(publicationFeedbackComments.feedbackId, feedbackId));
      await logAdminAudit(status === "released" ? "admin_publication_feedback_released" : status === "withdrawn" ? "admin_publication_feedback_withdrawn" : "admin_publication_feedback_released", { actor_id: actorUserId, feedback_id: feedbackId, submission_id: submissionId, operation, next_status: status });
    }
    return NextResponse.json({ success: true });
  }
  if (operation === "save_announcement" || operation === "set_announcement_status") {
    if (qualificationRelease) {
      const current = (await db.select().from(publicationQualificationAnnouncements).where(and(eq(publicationQualificationAnnouncements.eventId, event.id), eq(publicationQualificationAnnouncements.submissionId, submissionId))).limit(1))[0];
      const announcementId = current?.id ?? `pqan_${nanoid(12)}`;
      if (!current) await db.insert(publicationQualificationAnnouncements).values({ id: announcementId, eventId: event.id, submissionId, status: "draft", actorUserId, updatedAt: now });
      if (operation === "save_announcement") {
        const markdown = typeof input.markdown === "string" ? input.markdown.slice(0, 5000) : "";
        await db.update(publicationQualificationAnnouncements).set({ markdown: markdown || null, actorUserId, updatedAt: now }).where(eq(publicationQualificationAnnouncements.id, announcementId));
      } else {
        const status = typeof input.status === "string" ? input.status : "";
        if (!announcementStatuses.has(status)) return NextResponse.json({ error: "Invalid announcement state." }, { status: 400 });
        await db.update(publicationQualificationAnnouncements).set({ status: status as "draft", publishedAt: status === "published" ? now : null, actorUserId, updatedAt: now }).where(eq(publicationQualificationAnnouncements.id, announcementId));
      }
      await recordQualificationRevision(release, actorUserId, `qualification announcement ${operation}`, now);
      await logAdminAudit("admin_publication_announcement_updated", { actor_id: actorUserId, event_id: event.id, submission_id: submissionId, operation, qualification: true, status: typeof input.status === "string" ? input.status : "draft" });
      return NextResponse.json({ success: true });
    }
    const current = (await db.select().from(publicationAnnouncements).where(eq(publicationAnnouncements.eventId, event.id)).limit(1))[0];
    const announcementId = current?.id ?? `pan_${nanoid(12)}`;
    if (!current) await db.insert(publicationAnnouncements).values({ id: announcementId, eventId: event.id, status: "draft", actorUserId, updatedAt: now });
    if (operation === "save_announcement") {
      const markdown = typeof input.markdown === "string" ? input.markdown.slice(0, 5000) : "";
      await db.update(publicationAnnouncements).set({ markdown: markdown || null, actorUserId, updatedAt: now }).where(eq(publicationAnnouncements.id, announcementId));
    } else {
      const status = typeof input.status === "string" ? input.status : "";
      if (!announcementStatuses.has(status)) return NextResponse.json({ error: "Invalid announcement state." }, { status: 400 });
      await db.update(publicationAnnouncements).set({ status: status as "draft", publishedAt: status === "published" ? now : null, actorUserId, updatedAt: now }).where(eq(publicationAnnouncements.id, announcementId));
    }
    await logAdminAudit("admin_publication_announcement_updated", { actor_id: actorUserId, operation, status: typeof input.status === "string" ? input.status : "draft" });
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "Unsupported publication operation." }, { status: 400 });
}

export const POST = withAdminApi("POST /api/admin/publication", postPublication);
