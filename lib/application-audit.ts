import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";

export type ApplicationAuditAction =
  | "application_viby_login_started"
  | "application_viby_login_succeeded"
  | "application_viby_login_denied"
  | "application_viby_link_started"
  | "application_viby_link_succeeded";

export async function logApplicationAudit(
  action: ApplicationAuditAction,
  metadata: Record<string, unknown> = {},
) {
  try {
    const safeMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([, value]) =>
        typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null,
      ),
    );
    await db.insert(auditEvents).values({
      id: nanoid(),
      entityType: "application_auth",
      entityId: String(metadata.route ?? metadata.reason ?? "application"),
      action,
      actorType: "user",
      actorId: null,
      metadata: safeMetadata,
      createdAt: new Date(),
    });
  } catch {
    // Audit persistence cannot block authentication decisions.
  }
}
