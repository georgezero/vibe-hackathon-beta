import { desc, inArray, like, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";

const ACTIVITY_LABELS: Record<string, string> = {
  submission_draft_created: "Draft created",
  submission_claim_confirmed: "Submission claimed",
  submission_updated: "Project details updated",
  submission_membership_invited: "A teammate was invited",
  submission_membership_joined: "A teammate joined the team",
  submission_membership_revoked: "A teammate was removed",
  submission_finalized: "Submission finalized",
  chat_room_created: "Private team room created",
  preview_updated: "Preview updated",
};

export type ProjectActivityItem = {
  id: string;
  eventType: string;
  label: string;
  occurredAt: Date;
};

export async function listProjectActivity(submissionId: string, limit = 50): Promise<ProjectActivityItem[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const rows: Array<{ id: string; action: string; createdAt: Date }> = await db.select({
    id: auditEvents.id,
    action: auditEvents.action,
    createdAt: auditEvents.createdAt,
  }).from(auditEvents)
    .where(or(
      like(auditEvents.entityId, submissionId),
      like(auditEvents.metadata, `%${submissionId}%`),
    ))
    .orderBy(desc(auditEvents.createdAt))
    .limit(safeLimit * 3);

  return rows
    .filter((row) => Boolean(ACTIVITY_LABELS[row.action]))
    .slice(0, safeLimit)
    .map((row) => ({
      id: row.id,
      eventType: row.action,
      label: ACTIVITY_LABELS[row.action],
      occurredAt: row.createdAt,
    }));
}

/**
 * Bounded home-page projection: fetch the latest known project activity for
 * all cards in one query instead of opening one audit query per project.
 */
export async function listLatestProjectActivityBySubmission(submissionIds: string[]): Promise<Map<string, ProjectActivityItem>> {
  const ids = [...new Set(submissionIds)].filter(Boolean);
  if (!ids.length) return new Map();
  const metadataMatches = ids.map((submissionId) => like(auditEvents.metadata, `%${submissionId}%`));
  const rows: Array<{ id: string; entityId: string | null; action: string; metadata: unknown; createdAt: Date }> = await db.select({
    id: auditEvents.id,
    entityId: auditEvents.entityId,
    action: auditEvents.action,
    metadata: auditEvents.metadata,
    createdAt: auditEvents.createdAt,
  }).from(auditEvents)
    .where(or(inArray(auditEvents.entityId, ids), ...metadataMatches))
    .orderBy(desc(auditEvents.createdAt));

  const bySubmission = new Map<string, ProjectActivityItem>();
  for (const row of rows) {
    const submissionId = row.entityId && ids.includes(row.entityId)
      ? row.entityId
      : ids.find((candidate) => String(row.metadata ?? "").includes(candidate));
    if (!submissionId || bySubmission.has(submissionId) || !ACTIVITY_LABELS[row.action]) continue;
    bySubmission.set(submissionId, {
      id: row.id,
      eventType: row.action,
      label: ACTIVITY_LABELS[row.action],
      occurredAt: row.createdAt,
    });
  }
  return bySubmission;
}
