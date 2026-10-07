import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";

export async function logAdminAudit(
  action:
    | "viby_admin_assertion_received"
    | "viby_admin_assertion_denied"
    | "viby_admin_session_created"
    | "viby_admin_session_rejected"
    | "admin_session_rejected"
    | "viby_admin_logout"
    | "viby_admin_dev_session_created"
    | "viby_agent_action_attributed"
    | "viby_agent_action_denied"
    | "viby_verified_artifact_created"
    | "viby_verified_artifact_denied"
    | "admin_api_access_denied"
    | "admin_api_mutation"
    | "viby_identity_link_pending_created"
    | "viby_identity_link_confirmed"
    | "viby_identity_link_failed"
    | "viby_identity_link_cancelled"
    | "viby_legacy_identity_detected"
    | "viby_legacy_identity_claim_confirmed"
    | "admin_judging_evaluation_frozen"
    | "admin_judging_evaluation_reopened"
    | "admin_judging_assignment_reassigned"
    | "admin_judging_assignment_removed"
    | "admin_judging_assignment_conflict_updated"
    | "admin_results_tie_reviewed"
    | "admin_results_finalist_added"
    | "admin_results_finalist_removed"
    | "admin_results_winner_assigned"
    | "admin_results_winner_removed"
    | "admin_results_published"
    | "admin_results_unpublished"
    | "admin_calibration_consensus_started"
    | "admin_calibration_consensus_completed"
    | "admin_calibration_consensus_reopened"
    | "admin_calibration_threshold_changed"
    | "admin_calibration_note_added"
    | "admin_calibration_flagged"
    | "admin_publication_approved"
    | "admin_publication_reviewed"
    | "admin_publication_released"
    | "admin_publication_withdrawn"
    | "admin_publication_archived"
    | "admin_publication_feedback_released"
    | "admin_publication_feedback_withdrawn"
    | "admin_publication_award_assigned"
    | "admin_publication_award_removed"
    | "admin_publication_announcement_updated"
    | "admin_publication_mode_changed",
  metadata: Record<string, unknown>,
) {
  try {
    const safeKeys = new Set([
      "action", "action_name", "artifact_hash", "artifact_type", "audience",
      "audit_id", "authentication_mechanism",
      "confidence", "method", "mode", "reason", "route", "status", "success",
      "timestamp", "validation_stage", "viby_status", "actor_type", "delegation_method",
      "correlation_id", "idempotent",
      "actor_id", "submission_id", "judge_id", "assignment_id", "replacement_judge_id",
      "previous_status", "next_status", "operation",
      "tie_key", "category", "award_label", "result_status", "publication_status",
      "consensus_id", "threshold_type", "threshold_value", "note_length", "flagged_reason",
      "release_id", "publication_mode", "award_id", "feedback_id", "comment_id", "show_scores",
    ]);
    const safeMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([key, value]) => safeKeys.has(key) && (
        typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null
      )),
    );
    await db.insert(auditEvents).values({
      id: nanoid(),
      entityType: "admin_identity",
      entityId: String(metadata.action ?? metadata.reason ?? "admin"),
      action,
      actorType: "admin",
      actorId: typeof metadata.actor_id === "string" ? metadata.actor_id : null,
      metadata: safeMetadata,
      createdAt: new Date(),
    });
  } catch {
    // Audit should not block admin identity confirmation.
  }
}
