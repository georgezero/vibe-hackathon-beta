import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getResultsData, getResultDetail } from "@/lib/results";
import {
  events,
  publicationAnnouncements,
  publicationAwards,
  publicationFeedback,
  publicationFeedbackComments,
  publicationQualificationAnnouncements,
  publicationQualificationReleases,
  publicationReleases,
  submissions,
  submissionMemberships,
  teamMembers,
} from "@/lib/db/schema";
import { isPublicationQualificationEnabled, isPublicationQualificationSubmission } from "@/lib/publication-qualification";
import type { InferSelectModel } from "drizzle-orm";

export const PUBLICATION_AWARD_CATEGORIES = [
  ["grand_prize", "Grand Prize"],
  ["runner_up", "Runner-up"],
  ["honorable_mention", "Honorable Mention"],
  ["innovation", "Innovation Award"],
  ["clinical_impact", "Clinical Impact Award"],
  ["technical_excellence", "Technical Excellence"],
  ["peoples_choice", "People's Choice"],
  ["custom", "Custom award"],
] as const;

export type PublicationStatus = "calculated" | "reviewed" | "approved" | "published" | "archived";
export type PublicationMode = "awards_only" | "awards_feedback" | "feedback_later" | "everything";

type Release = InferSelectModel<typeof publicationReleases>;
type QualificationRelease = InferSelectModel<typeof publicationQualificationReleases>;
type QualificationAnnouncement = InferSelectModel<typeof publicationQualificationAnnouncements>;
type Award = InferSelectModel<typeof publicationAwards>;
type Feedback = InferSelectModel<typeof publicationFeedback>;
type FeedbackComment = InferSelectModel<typeof publicationFeedbackComments>;
type Submission = InferSelectModel<typeof submissions>;
type Member = InferSelectModel<typeof teamMembers>;

export type PublicationRow = {
  submissionId: string;
  projectTitle: string;
  teamName: string;
  institution: string;
  rank: number | null;
  score: number | null;
  finalist: boolean;
  awards: Array<{ id: string; category: string; label: string }>;
  feedbackStatus: "draft" | "released" | "withdrawn" | "none";
  commentCount: number;
  feedbackPreview: string | null;
  published: boolean;
};

export type PublicationData = {
  event: { id: string; name: string } | null;
  release: { id: string; status: PublicationStatus; publicationMode: PublicationMode; showScores: boolean; publishedAt: string | null; approvedAt: string | null };
  rows: PublicationRow[];
  summary: { submissions: number; published: number; unpublished: number; finalists: number; awards: number; feedbackReleased: number; pendingReview: number; readyToPublish: number };
  announcement: { id: string; markdown: string | null; status: string } | null;
};

function iso(value: Date | null | undefined) { return value ? value.toISOString() : null; }
function awardLabel(category: string) { return PUBLICATION_AWARD_CATEGORIES.find(([key]) => key === category)?.[1] ?? category.replaceAll("_", " "); }

function fallbackRelease(eventId: string, sourceStatus: string | undefined): PublicationData["release"] {
  void sourceStatus;
  return { id: `pr_${eventId}`, status: "calculated", publicationMode: "awards_only", showScores: true, publishedAt: null, approvedAt: null };
}

export async function getPublicationData(eventId: string): Promise<PublicationData> {
  const [eventRows, releaseRows, qualificationReleaseRows, awards, feedbackRows, commentRows, announcementRows, qualificationAnnouncementRows, results] = await Promise.all([
    db.select({ id: events.id, name: events.name }).from(events).where(eq(events.id, eventId)).limit(1),
    db.select().from(publicationReleases).where(eq(publicationReleases.eventId, eventId)).limit(1),
    db.select().from(publicationQualificationReleases).where(eq(publicationQualificationReleases.eventId, eventId)),
    db.select().from(publicationAwards).where(and(eq(publicationAwards.eventId, eventId), eq(publicationAwards.status, "active"))),
    db.select().from(publicationFeedback).where(eq(publicationFeedback.eventId, eventId)),
    db.select().from(publicationFeedbackComments),
    db.select().from(publicationAnnouncements).where(eq(publicationAnnouncements.eventId, eventId)).limit(1),
    db.select().from(publicationQualificationAnnouncements).where(eq(publicationQualificationAnnouncements.eventId, eventId)),
    getResultsData(eventId),
  ]);
  const event = eventRows[0] ?? null;
  if (!event) return { event: null, release: fallbackRelease(eventId, undefined), rows: [], summary: { submissions: 0, published: 0, unpublished: 0, finalists: 0, awards: 0, feedbackReleased: 0, pendingReview: 0, readyToPublish: 0 }, announcement: null };
  const qualificationMode = isPublicationQualificationEnabled();
  const qualificationRows = qualificationReleaseRows as QualificationRelease[];
  const allowlistedFixtureIds = new Set(qualificationMode ? qualificationRows.filter((release: QualificationRelease) => isPublicationQualificationSubmission(release.submissionId)).map((release: QualificationRelease) => release.submissionId) : []);
  const visibleResults = results.rows.filter((row) => !qualificationRows.some((release: QualificationRelease) => release.submissionId === row.submissionId) ? !qualificationMode : allowlistedFixtureIds.has(row.submissionId));
  const release = qualificationMode ? qualificationRows.find((candidate: QualificationRelease) => isPublicationQualificationSubmission(candidate.submissionId)) : undefined;
  const eventRelease = releaseRows[0] as Release | undefined;
  const releaseView = release ? { id: release.id, status: release.status as PublicationStatus, publicationMode: release.publicationMode as PublicationMode, showScores: release.showScores, publishedAt: iso(release.publishedAt), approvedAt: iso(release.approvedAt) } : eventRelease ? { id: eventRelease.id, status: eventRelease.status as PublicationStatus, publicationMode: eventRelease.publicationMode as PublicationMode, showScores: eventRelease.showScores, publishedAt: iso(eventRelease.publishedAt), approvedAt: iso(eventRelease.approvedAt) } : fallbackRelease(eventId, results.publication);
  const feedbackBySubmission = new Map((feedbackRows as Feedback[]).map((row) => [row.submissionId, row]));
  const commentsByFeedback = new Map<string, FeedbackComment[]>();
  for (const comment of commentRows as FeedbackComment[]) { const list = commentsByFeedback.get(comment.feedbackId) ?? []; list.push(comment); commentsByFeedback.set(comment.feedbackId, list); }
  const awardBySubmission = new Map<string, Award[]>();
  for (const award of awards as Award[]) { const list = awardBySubmission.get(award.submissionId) ?? []; list.push(award); awardBySubmission.set(award.submissionId, list); }
  const rows: PublicationRow[] = visibleResults.map((row) => {
    const feedback = feedbackBySubmission.get(row.submissionId);
    const comments = feedback ? commentsByFeedback.get(feedback.id) ?? [] : [];
    return { submissionId: row.submissionId, projectTitle: row.projectTitle, teamName: row.teamName, institution: row.institution, rank: row.rank, score: row.score, finalist: row.finalist, awards: (awardBySubmission.get(row.submissionId) ?? []).map((award) => ({ id: award.id, category: award.category, label: award.label || awardLabel(award.category) })), feedbackStatus: feedback?.status ?? "none", commentCount: comments.length, feedbackPreview: feedback?.administratorSummary ?? null, published: releaseView.status === "published" || releaseView.status === "archived" };
  });
  const published = releaseView.status === "published" || releaseView.status === "archived";
  const announcement = release ? (qualificationAnnouncementRows as QualificationAnnouncement[]).find((candidate: QualificationAnnouncement) => candidate.submissionId === release.submissionId) ?? null : announcementRows[0] ?? null;
  return { event, release: releaseView, rows, summary: { submissions: rows.length, published: published ? rows.filter((row) => row.awards.length > 0).length : 0, unpublished: published ? rows.filter((row) => row.awards.length === 0).length : rows.length, finalists: rows.filter((row) => row.finalist).length, awards: rows.reduce((sum, row) => sum + row.awards.length, 0), feedbackReleased: rows.filter((row) => row.feedbackStatus === "released").length, pendingReview: releaseView.status === "calculated" || releaseView.status === "reviewed" ? 1 : 0, readyToPublish: rows.every((row) => row.rank !== null) && rows.length > 0 ? 1 : 0 }, announcement: announcement ? { id: announcement.id, markdown: announcement.markdown, status: announcement.status } : null };
}

export async function getPublicationDetail(eventId: string, submissionId: string) {
  const data = await getPublicationData(eventId);
  const row = data.rows.find((item) => item.submissionId === submissionId);
  if (!row) return null;
  const [feedbackRows, commentsRows, submissionsRows, membersRows, qualificationAnnouncementRows, detail] = await Promise.all([
    db.select().from(publicationFeedback).where(and(eq(publicationFeedback.eventId, eventId), eq(publicationFeedback.submissionId, submissionId))).limit(1),
    db.select().from(publicationFeedbackComments),
    db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1),
    db.select().from(teamMembers).where(eq(teamMembers.submissionId, submissionId)),
    db.select().from(publicationQualificationAnnouncements).where(and(eq(publicationQualificationAnnouncements.eventId, eventId), eq(publicationQualificationAnnouncements.submissionId, submissionId))).limit(1),
    getResultDetail(eventId, submissionId),
  ]);
  const feedback = feedbackRows[0] as Feedback | undefined;
  const comments = (commentsRows as FeedbackComment[]).filter((comment) => comment.feedbackId === feedback?.id);
  const submission = submissionsRows[0] as Submission | undefined;
  const qualification = isPublicationQualificationSubmission(submissionId)
    ? (await db.select().from(publicationQualificationReleases).where(and(eq(publicationQualificationReleases.eventId, eventId), eq(publicationQualificationReleases.submissionId, submissionId))).limit(1))[0]
    : null;
  const qualificationMode = isPublicationQualificationEnabled();
  const release = qualification
    ? { id: qualification.id, status: qualification.status as PublicationStatus, publicationMode: qualification.publicationMode as PublicationMode, showScores: qualification.showScores, publishedAt: iso(qualification.publishedAt), approvedAt: iso(qualification.approvedAt) }
    : qualificationMode
      ? { id: `pqr_${eventId}_${submissionId}`, status: "calculated" as const, publicationMode: "awards_only" as const, showScores: false, publishedAt: null, approvedAt: null }
      : data.release;
  const qualificationAnnouncement = qualificationAnnouncementRows[0];
  const effectiveData = qualification ? { ...data, release, announcement: qualificationAnnouncement ? { id: qualificationAnnouncement.id, markdown: qualificationAnnouncement.markdown, status: qualificationAnnouncement.status } : data.announcement } : data;
  return { data: effectiveData, row: qualification ? { ...row, published: qualification.status === "published" || qualification.status === "archived" } : row, project: { title: submission?.projectTitle || row.projectTitle, team: submission?.teamName || row.teamName, state: submission?.status || "draft", institution: (membersRows as Member[])[0]?.affiliation || row.institution }, feedback: feedback ? { id: feedback.id, summary: feedback.administratorSummary, status: feedback.status, comments: comments.map((comment) => ({ id: comment.id, comment: comment.comment, status: comment.status })) } : null, criterionBreakdown: detail?.criterionBreakdown ?? [], publishedAt: release.publishedAt };
}

export type ParticipantPublicationProjection =
  | { status: "pending"; project: { title: string; team: string; state: string; institution: string }; releaseStatus: PublicationStatus; announcement: string | null }
  | { status: "available" | "feedback" | "archived"; project: { title: string; team: string; state: string; institution: string }; rank: number | null; finalist: boolean; awards: Array<{ id: string; label: string }>; score: number | null; criteria: Array<{ key: string; label: string; average: number | null }>; feedback: { summary: string | null; comments: string[] } | null; announcement: string | null; publishedAt: string | null };

/**
 * The sole participant-visible publication projection. Admin preview calls
 * this same function, so private notes, judge identity, and internal review
 * data cannot accidentally diverge between the two surfaces.
 */
export function buildParticipantPublicationProjection(detail: Awaited<ReturnType<typeof getPublicationDetail>>): ParticipantPublicationProjection | null {
  if (!detail) return null;
  const releaseStatus = detail.data.release.status;
  if (releaseStatus !== "published" && releaseStatus !== "archived") {
    return { status: "pending", project: detail.project, releaseStatus, announcement: null };
  }
  const feedbackAvailable = detail.feedback?.status === "released";
  const feedbackVisible = feedbackAvailable && (detail.data.release.publicationMode === "awards_feedback" || detail.data.release.publicationMode === "everything" || detail.data.release.publicationMode === "feedback_later");
  const awardsVisible = detail.data.release.publicationMode === "awards_only" || detail.data.release.publicationMode === "awards_feedback" || detail.data.release.publicationMode === "everything" || detail.data.release.publicationMode === "feedback_later";
  return {
    status: releaseStatus === "archived" ? "archived" : feedbackVisible ? "feedback" : "available",
    project: detail.project,
    rank: detail.row.rank,
    finalist: detail.row.finalist,
    awards: awardsVisible ? detail.row.awards.map(({ id, label }) => ({ id, label })) : [],
    score: detail.data.release.showScores ? detail.row.score : null,
    criteria: detail.data.release.showScores ? detail.criterionBreakdown.map(({ key, label, average }) => ({ key, label, average })) : [],
    feedback: feedbackVisible ? { summary: detail.feedback?.summary ?? null, comments: detail.feedback?.comments.filter((comment) => comment.status === "released").map((comment) => comment.comment) ?? [] } : null,
    announcement: detail.data.announcement?.status === "published" ? detail.data.announcement.markdown : null,
    publishedAt: detail.publishedAt,
  };
}

export async function getParticipantResults(eventId: string, submissionId: string, userId: string) {
  const membership = (await db.select({ id: submissionMemberships.id }).from(submissionMemberships).where(and(eq(submissionMemberships.submissionId, submissionId), eq(submissionMemberships.userId, userId), eq(submissionMemberships.status, "active"))).limit(1))[0];
  if (!membership) return { status: "forbidden" as const };
  const qualificationRow = (await db.select({ id: publicationQualificationReleases.id }).from(publicationQualificationReleases).where(and(eq(publicationQualificationReleases.eventId, eventId), eq(publicationQualificationReleases.submissionId, submissionId))).limit(1))[0];
  if (isPublicationQualificationEnabled() && !isPublicationQualificationSubmission(submissionId)) {
    const [submission] = await db.select({ title: submissions.projectTitle, team: submissions.teamName, state: submissions.status }).from(submissions).where(and(eq(submissions.eventId, eventId), eq(submissions.id, submissionId))).limit(1);
    if (!submission) return { status: "not_found" as const };
    return { status: "pending" as const, project: { title: submission.title || "Project", team: submission.team || "Team", state: submission.state || "draft", institution: "" }, releaseStatus: "calculated" as const };
  }
  if (qualificationRow && !isPublicationQualificationEnabled()) {
    const [submission] = await db.select({ title: submissions.projectTitle, team: submissions.teamName, state: submissions.status }).from(submissions).where(and(eq(submissions.eventId, eventId), eq(submissions.id, submissionId))).limit(1);
    if (!submission) return { status: "not_found" as const };
    return { status: "pending" as const, project: { title: submission.title || "Project", team: submission.team || "Team", state: submission.state || "draft", institution: "" }, releaseStatus: "calculated" as const };
  }
  if (!qualificationRow && isPublicationQualificationEnabled() && isPublicationQualificationSubmission(submissionId)) {
    const [submission] = await db.select({ title: submissions.projectTitle, team: submissions.teamName, state: submissions.status }).from(submissions).where(and(eq(submissions.eventId, eventId), eq(submissions.id, submissionId))).limit(1);
    if (!submission) return { status: "not_found" as const };
    return { status: "pending" as const, project: { title: submission.title || "Project", team: submission.team || "Team", state: submission.state || "draft", institution: "" }, releaseStatus: "calculated" as const };
  }
  const detail = await getPublicationDetail(eventId, submissionId);
  if (!detail) return { status: "not_found" as const };
  return buildParticipantPublicationProjection(detail) as ParticipantPublicationProjection;
}
