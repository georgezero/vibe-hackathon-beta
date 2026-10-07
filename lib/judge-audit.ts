import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";

export type JudgeAuditAction =
  | "judge_password_login_succeeded"
  | "judge_access_denied"
  | "judge_logout"
  | "judge_score_created"
  | "judge_score_updated"
  | "judge_viby_login_started"
  | "judge_viby_login_succeeded"
  | "judge_viby_login_cancelled"
  | "judge_viby_login_denied"
  | "judge_viby_link_started"
  | "judge_viby_link_succeeded"
  | "judge_viby_link_conflict"
  | "judge_viby_fresh_required"
  | "judge_viby_remembered_login";

export async function logJudgeAudit(
  action: JudgeAuditAction,
  metadata: {
    userId?: string | null;
    judgeId?: string | null;
    authorizationId?: string | null;
    eventId?: string | null;
    submissionId?: string | null;
    route?: string | null;
    reason?: string | null;
    mode?: string | null;
  },
) {
  try {
    const safeMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([, value]) =>
        typeof value === "string" || value === null
      ),
    );
    await db.insert(auditEvents).values({
      id: nanoid(),
      entityType: "judge_access",
      entityId: metadata.authorizationId
        ?? metadata.judgeId
        ?? metadata.userId
        ?? "judge",
      action,
      actorType: metadata.userId ? "user" : "judge",
      actorId: metadata.userId ?? metadata.judgeId ?? null,
      metadata: safeMetadata,
      createdAt: new Date(),
    });
  } catch {
    // Audit persistence cannot weaken or broaden the authorization decision.
  }
}
