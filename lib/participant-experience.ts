import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { and, desc, eq, gte, lte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditEvents,
  participantFeedback,
  participantJourneyEvents,
  submissionMembershipInvitations,
  submissions,
} from "@/lib/db/schema";

export const PARTICIPANT_JOURNEY_EVENT_TYPES = [
  "participant_start_viewed",
  "participant_project_created",
  "participant_project_resumed",
  "participant_project_claim_started",
  "participant_project_claim_completed",
  "participant_project_claim_failed",
  "participant_my_projects_viewed",
  "participant_project_opened",
  "participant_next_action_followed",
  "participant_editor_viewed",
  "participant_draft_saved",
  "participant_save_validation_failed",
  "participant_stale_edit_detected",
  "participant_agent_instructions_revealed",
  "participant_agent_handoff_copied",
  "participant_agent_update_received",
  "participant_agent_update_rejected",
  "participant_returned_to_preview",
  "participant_preview_viewed",
  "participant_readiness_incomplete",
  "participant_readiness_complete",
  "participant_finalization_confirmation_opened",
  "participant_finalization_attempted",
  "participant_finalization_succeeded",
  "participant_finalization_rejected",
  "participant_receipt_viewed",
  "participant_invitation_created",
  "participant_invitation_accepted",
  "participant_invitation_expired",
  "participant_invitation_revoked",
  "participant_invitation_wrong_account",
  "participant_project_access_revoked",
  "participant_people_viewed",
  "participant_messages_viewed",
  "participant_profile_viewed",
  "participant_message_initiated",
  "participant_dm_created",
  "participant_community_opened",
  "participant_community_channel_opened",
  "participant_community_message_posted",
  "participant_team_chat_opened",
  "participant_team_chat_message_posted",
  "participant_explore_opened",
  "participant_navigation_destination_selected",
  "participant_workspace_returned",
] as const;
export type ParticipantJourneyEventType = typeof PARTICIPANT_JOURNEY_EVENT_TYPES[number];

export const PARTICIPANT_DEVICE_CLASSES = ["desktop", "mobile", "unknown"] as const;
export type ParticipantDeviceClass = typeof PARTICIPANT_DEVICE_CLASSES[number];

export const PARTICIPANT_NAV_DESTINATIONS = [
  "start", "resume", "my_projects", "editor", "preview", "team", "invitation",
  "team_chat", "people", "messages", "community", "explore", "workspace", "submit",
  "status", "ai_evals", "results", "unknown",
] as const;
export type ParticipantNavigationDestination = typeof PARTICIPANT_NAV_DESTINATIONS[number];

export const PARTICIPANT_CONTEXTS = [
  "start", "resume", "my_projects", "editor", "preview", "team", "invitation", "workspace",
  "people", "messages", "community", "team_chat", "explore", "submit", "unknown",
] as const;
export type ParticipantExperienceContext = typeof PARTICIPANT_CONTEXTS[number];

export const PARTICIPANT_OUTCOMES = ["success", "failure", "guardrail", "viewed", "started", "abandoned"] as const;
export type ParticipantJourneyOutcome = typeof PARTICIPANT_OUTCOMES[number];

export const PARTICIPANT_FAILURE_REASONS = [
  "readiness_incomplete", "validation", "stale_edit", "deadline", "frozen",
  "expired_invitation", "revoked_invitation", "wrong_account", "unauthorized",
  "rate_limited", "duplicate_retry", "invalid_token", "unknown",
] as const;
export type ParticipantJourneyReason = typeof PARTICIPANT_FAILURE_REASONS[number];

export const PARTICIPANT_FEEDBACK_CATEGORIES = ["confusing", "could_not_complete", "broken", "suggestion", "other"] as const;
export type ParticipantFeedbackCategory = typeof PARTICIPANT_FEEDBACK_CATEGORIES[number];
export const PARTICIPANT_FEEDBACK_STATUSES = ["new", "reviewed", "resolved", "dismissed"] as const;
export type ParticipantFeedbackStatus = typeof PARTICIPANT_FEEDBACK_STATUSES[number];

export type ParticipantJourneyWindow = "today" | "last_24_hours" | "last_7_days" | "event_to_date";

export const PARTICIPANT_EXPERIENCE_RETENTION_DAYS = 90;
export const PARTICIPANT_FEEDBACK_RETENTION_DAYS = 180;

const valid = <T extends readonly string[]>(values: T, value: unknown): value is T[number] => typeof value === "string" && values.includes(value as T[number]);

export function participantHash(eventId: string, userId: string) {
  return createHash("sha256").update(`h2:participant:${eventId}:${userId}`).digest("hex");
}

export function participantExperienceWindowBounds(window: ParticipantJourneyWindow, now = new Date()) {
  const end = now;
  if (window === "today") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { start, end };
  }
  if (window === "last_24_hours") return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end };
  if (window === "last_7_days") return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end };
  return { start: new Date(0), end };
}

export function parseParticipantJourneyWindow(value: unknown): ParticipantJourneyWindow {
  return value === "today" || value === "last_24_hours" || value === "last_7_days" || value === "event_to_date"
    ? value
    : "event_to_date";
}

export interface RecordParticipantJourneyEventInput {
  eventId: string;
  eventType: ParticipantJourneyEventType;
  participantUserId?: string | null;
  deviceClass?: ParticipantDeviceClass;
  source?: ParticipantNavigationDestination;
  destination?: ParticipantNavigationDestination;
  outcome?: ParticipantJourneyOutcome;
  reason?: ParticipantJourneyReason;
  context?: ParticipantExperienceContext;
  durationMs?: number;
  occurredAt?: Date;
}

/**
 * Journey telemetry is non-authoritative. Invalid or unavailable telemetry
 * must never block the participant action that triggered it.
 */
export async function recordParticipantJourneyEvent(input: RecordParticipantJourneyEventInput) {
  if (!input.eventId.trim() || !valid(PARTICIPANT_JOURNEY_EVENT_TYPES, input.eventType)) return false;
  if (input.deviceClass !== undefined && !valid(PARTICIPANT_DEVICE_CLASSES, input.deviceClass)) return false;
  if (input.source !== undefined && !valid(PARTICIPANT_NAV_DESTINATIONS, input.source)) return false;
  if (input.destination !== undefined && !valid(PARTICIPANT_NAV_DESTINATIONS, input.destination)) return false;
  if (input.outcome !== undefined && !valid(PARTICIPANT_OUTCOMES, input.outcome)) return false;
  if (input.reason !== undefined && !valid(PARTICIPANT_FAILURE_REASONS, input.reason)) return false;
  if (input.context !== undefined && !valid(PARTICIPANT_CONTEXTS, input.context)) return false;
  if (input.durationMs !== undefined && (!Number.isInteger(input.durationMs) || input.durationMs < 0 || input.durationMs > 86_400_000)) return false;
  try {
    await db.insert(participantJourneyEvents).values({
      id: `pje_${nanoid(14)}`,
      eventId: input.eventId,
      eventType: input.eventType,
      participantHash: input.participantUserId ? participantHash(input.eventId, input.participantUserId) : null,
      deviceClass: input.deviceClass ?? "unknown",
      source: input.source,
      destination: input.destination,
      outcome: input.outcome,
      reason: input.reason,
      context: input.context,
      durationMs: input.durationMs,
      occurredAt: input.occurredAt ?? new Date(),
    });
    return true;
  } catch {
    return false;
  }
}

export function feedbackMessageIsValid(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 1000;
}

export function feedbackCategoryIsValid(value: unknown): value is ParticipantFeedbackCategory {
  return valid(PARTICIPANT_FEEDBACK_CATEGORIES, value);
}

export function feedbackStatusIsValid(value: unknown): value is ParticipantFeedbackStatus {
  return valid(PARTICIPANT_FEEDBACK_STATUSES, value);
}

export async function createParticipantFeedback(input: {
  eventId: string;
  participantUserId: string;
  category: ParticipantFeedbackCategory;
  context: ParticipantExperienceContext;
  message: string;
}) {
  if (!input.eventId.trim() || !feedbackCategoryIsValid(input.category) || !valid(PARTICIPANT_CONTEXTS, input.context) || !feedbackMessageIsValid(input.message)) return null;
  try {
    const now = new Date();
    const hash = participantHash(input.eventId, input.participantUserId);
    const recent = await db.select({ id: participantFeedback.id }).from(participantFeedback).where(and(
      eq(participantFeedback.eventId, input.eventId),
      eq(participantFeedback.participantHash, hash),
      gte(participantFeedback.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
    )).limit(4);
    if (recent.length >= 3) return "rate_limited" as const;
    const id = `pf_${nanoid(14)}`;
    await db.insert(participantFeedback).values({
      id,
      eventId: input.eventId,
      participantHash: hash,
      category: input.category,
      context: input.context,
      message: input.message.trim(),
      status: "new",
      createdAt: now,
    });
    return id;
  } catch {
    // Feedback is optional and non-authoritative. A missing/unavailable
    // observation table must produce a retryable UI state, never a participant
    // workflow failure or an unhandled server error.
    return null;
  }
}

type JourneyRow = typeof participantJourneyEvents.$inferSelect;
type FeedbackAggregateRow = { id: string; category: string; context: string; message: string; status: string; createdAt: Date; reviewedAt: Date | null };
type SubmissionAggregateRow = { status: string; createdAt: Date; finalizedAt: Date | null };
type InvitationAggregateRow = { status: string; createdAt: Date; acceptedAt: Date | null };

function uniqueParticipants(rows: JourneyRow[]) {
  return new Set(rows.map((row) => row.participantHash).filter((value): value is string => Boolean(value))).size;
}

function countEventTypes(rows: JourneyRow[], types: ParticipantJourneyEventType[]) {
  const matches = rows.filter((row) => types.includes(row.eventType as ParticipantJourneyEventType));
  return { count: matches.length, participants: uniqueParticipants(matches) };
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

function durationStats(rows: JourneyRow[]) {
  const durations = rows.map((row) => row.durationMs).filter((value): value is number => typeof value === "number" && value >= 0);
  return { medianMs: percentile(durations, 0.5), p90Ms: percentile(durations, 0.9) };
}

const FRICTION_LABELS: Record<string, string> = {
  readiness_incomplete: "Readiness incomplete",
  validation: "Validation failed",
  stale_edit: "Project changed elsewhere",
  deadline: "Deadline guardrail",
  frozen: "Event frozen",
  expired_invitation: "Invitation expired",
  revoked_invitation: "Invitation revoked",
  wrong_account: "Wrong-account invitation warning",
  unauthorized: "Access denied",
  rate_limited: "Rate limited",
  duplicate_retry: "Safe duplicate retry",
  invalid_token: "Invalid private link",
  unknown: "Other bounded failure",
};

const ADOPTION_GROUPS: Array<{ key: string; label: string; types: ParticipantJourneyEventType[] }> = [
  { key: "my_projects", label: "My Projects", types: ["participant_my_projects_viewed", "participant_workspace_returned"] },
  { key: "agent", label: "Coding agent", types: ["participant_agent_instructions_revealed", "participant_agent_handoff_copied", "participant_agent_update_received", "participant_returned_to_preview"] },
  { key: "team", label: "Team", types: ["participant_invitation_created", "participant_invitation_accepted"] },
  { key: "team_chat", label: "Team Chat", types: ["participant_team_chat_opened", "participant_team_chat_message_posted"] },
  { key: "people", label: "People", types: ["participant_people_viewed", "participant_profile_viewed"] },
  { key: "messages", label: "Messages", types: ["participant_messages_viewed", "participant_message_initiated", "participant_dm_created"] },
  { key: "community", label: "Community", types: ["participant_community_opened", "participant_community_channel_opened", "participant_community_message_posted"] },
  { key: "explore", label: "Explore", types: ["participant_explore_opened", "participant_navigation_destination_selected"] },
];

export async function getParticipantExperienceData(input: { eventId: string; window: ParticipantJourneyWindow; now?: Date }) {
  const now = input.now ?? new Date();
  const bounds = participantExperienceWindowBounds(input.window, now);
  const [journeyRows, feedbackRows, submissionRows, invitationRows] = await Promise.all([
    db.select().from(participantJourneyEvents).where(and(eq(participantJourneyEvents.eventId, input.eventId), gte(participantJourneyEvents.occurredAt, bounds.start), lte(participantJourneyEvents.occurredAt, bounds.end))).orderBy(desc(participantJourneyEvents.occurredAt)),
    db.select({ id: participantFeedback.id, category: participantFeedback.category, context: participantFeedback.context, message: participantFeedback.message, status: participantFeedback.status, createdAt: participantFeedback.createdAt, reviewedAt: participantFeedback.reviewedAt }).from(participantFeedback).where(and(eq(participantFeedback.eventId, input.eventId), gte(participantFeedback.createdAt, bounds.start), lte(participantFeedback.createdAt, bounds.end))).orderBy(desc(participantFeedback.createdAt)).limit(50),
    db.select({ status: submissions.status, createdAt: submissions.createdAt, finalizedAt: submissions.finalizedAt }).from(submissions).where(and(eq(submissions.eventId, input.eventId), gte(submissions.createdAt, bounds.start), lte(submissions.createdAt, bounds.end))),
    db.select({ status: submissionMembershipInvitations.status, createdAt: submissionMembershipInvitations.createdAt, acceptedAt: submissionMembershipInvitations.acceptedAt }).from(submissionMembershipInvitations).innerJoin(submissions, eq(submissionMembershipInvitations.submissionId, submissions.id)).where(and(eq(submissions.eventId, input.eventId), gte(submissionMembershipInvitations.createdAt, bounds.start), lte(submissionMembershipInvitations.createdAt, bounds.end))),
  ]) as [JourneyRow[], FeedbackAggregateRow[], SubmissionAggregateRow[], InvitationAggregateRow[]];
  const rows = journeyRows;
  const start = countEventTypes(rows, ["participant_start_viewed"]);
  const project = countEventTypes(rows, ["participant_project_created", "participant_project_resumed"]);
  const editor = countEventTypes(rows, ["participant_editor_viewed"]);
  const preview = countEventTypes(rows, ["participant_preview_viewed"]);
  const attempted = countEventTypes(rows, ["participant_finalization_attempted"]);
  const finalized = countEventTypes(rows, ["participant_finalization_succeeded"]);
  const funnel = [
    { key: "start", label: "Start", ...start, conversion: 100 },
    { key: "project", label: "Project created or resumed", ...project, conversion: percent(project.participants, start.participants) },
    { key: "editor", label: "Editor reached", ...editor, conversion: percent(editor.participants, start.participants) },
    { key: "preview", label: "Preview viewed", ...preview, conversion: percent(preview.participants, start.participants) },
    { key: "attempted", label: "Finalization attempted", ...attempted, conversion: percent(attempted.participants, start.participants) },
    { key: "finalized", label: "Finalized", ...finalized, conversion: percent(finalized.participants, start.participants) },
  ];
  const frictionMap = new Map<string, { reason: string; label: string; count: number }>();
  for (const row of rows) {
    if (row.outcome !== "failure" && row.outcome !== "guardrail") continue;
    const reason = row.reason ?? "unknown";
    const current = frictionMap.get(reason) ?? { reason, label: FRICTION_LABELS[reason] ?? "Other bounded failure", count: 0 };
    current.count += 1;
    frictionMap.set(reason, current);
  }
  const adoption = ADOPTION_GROUPS.map((group) => {
    const result = countEventTypes(rows, group.types);
    return { ...group, count: result.count, participants: result.participants };
  });
  const navigation = PARTICIPANT_NAV_DESTINATIONS.filter((destination) => destination !== "unknown").map((destination) => ({
    destination,
    count: rows.filter((row) => row.destination === destination).length,
  })).filter((row) => row.count > 0);
  const deviceMap = new Map<ParticipantDeviceClass, Set<string>>();
  for (const row of rows) {
    const current = deviceMap.get(row.deviceClass as ParticipantDeviceClass) ?? new Set<string>();
    if (row.participantHash) current.add(row.participantHash);
    deviceMap.set(row.deviceClass as ParticipantDeviceClass, current);
  }
  const activityParticipants = uniqueParticipants(rows);
  const projectsStarted = submissionRows.length;
  const finalizedSubmissions = submissionRows.filter((row) => Boolean(row.finalizedAt) || row.status === "finalized" || row.status === "locked").length;
  const acceptedInvitations = invitationRows.filter((row) => row.status === "accepted" || Boolean(row.acceptedAt)).length;
  const smoothDenominator = project.participants;
  return {
    window: input.window,
    windowStart: bounds.start.toISOString(),
    windowEnd: bounds.end.toISOString(),
    overview: {
      participantsWithActivity: activityParticipants,
      projectsStarted,
      activeProjects: submissionRows.filter((row) => row.status === "draft" || row.status === "submitted").length,
      finalizedSubmissions,
      finalizationRate: percent(finalizedSubmissions, projectsStarted),
      invitationsAccepted: acceptedInvitations,
      agentParticipants: adoption.find((row) => row.key === "agent")?.participants ?? 0,
      communityParticipants: adoption.find((row) => row.key === "community")?.participants ?? 0,
      messageParticipants: adoption.find((row) => row.key === "messages")?.participants ?? 0,
      teamChatParticipants: adoption.find((row) => row.key === "team_chat")?.participants ?? 0,
    },
    funnel,
    friction: [...frictionMap.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    adoption,
    navigation,
    devices: [...deviceMap.entries()].map(([device, participants]) => ({ device, participants: participants.size })),
    timing: {
      editor: durationStats(rows.filter((row) => row.eventType === "participant_editor_viewed")),
      preview: durationStats(rows.filter((row) => row.eventType === "participant_preview_viewed")),
      finalization: durationStats(rows.filter((row) => row.eventType === "participant_finalization_succeeded")),
    },
    feedback: feedbackRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null })),
    definitions: {
      funnelDenominator: "Unique pseudonymous participants who generated a Start signal in the selected window.",
      finalizationDenominator: "Projects created in the selected event/window from authoritative submission rows.",
      smoothDenominator,
      note: "These are bounded signals, not a linear participant score or causal explanation.",
    },
  };
}

export async function updateParticipantFeedbackStatus(input: { eventId: string; feedbackId: string; status: ParticipantFeedbackStatus; reviewerUserId?: string | null }) {
  if (!feedbackStatusIsValid(input.status)) return false;
  const result = await db.update(participantFeedback).set({
    status: input.status,
    reviewedAt: input.status === "new" ? null : new Date(),
    reviewedByUserId: input.status === "new" ? null : input.reviewerUserId ?? null,
  }).where(and(eq(participantFeedback.id, input.feedbackId), eq(participantFeedback.eventId, input.eventId)));
  if (result.changes > 0) {
    await db.insert(auditEvents).values({
      id: `h2_feedback_${nanoid(14)}`,
      entityType: "participant_feedback",
      entityId: input.feedbackId,
      action: "participant_feedback_status_updated",
      actorType: "admin",
      actorId: input.reviewerUserId ?? null,
      metadata: { eventId: input.eventId, status: input.status },
      createdAt: new Date(),
    });
  }
  return result.changes > 0;
}

export async function purgeParticipantExperienceData(now = new Date()) {
  const telemetryCutoff = new Date(now.getTime() - PARTICIPANT_EXPERIENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const feedbackCutoff = new Date(now.getTime() - PARTICIPANT_FEEDBACK_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(participantJourneyEvents).where(lt(participantJourneyEvents.occurredAt, telemetryCutoff)).execute();
  await db.delete(participantFeedback).where(lt(participantFeedback.createdAt, feedbackCutoff)).execute();
  return { telemetryCutoff, feedbackCutoff };
}
