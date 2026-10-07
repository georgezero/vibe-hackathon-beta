import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  adminSessionProvenance,
  vibyIdentityLinks,
} from "@/lib/db/schema";
import type { VibyLoginOperation } from "@/lib/viby-login-policy";

export type InteractiveAuthenticationMethod =
  | "better_auth_session"
  | "better_auth_viby"
  | "legacy_viby_session";

export interface InteractiveSessionProvenance {
  authenticationMethod: "better_auth_viby";
  operation: VibyLoginOperation;
  verificationKind: "fresh" | "remembered" | null;
  verifiedAt: Date | null;
  linkedRuntimeIdentity: {
    provider: "viby";
    displayName: string;
    status: "active" | "revoked";
    revokedAt: Date | null;
  };
}

export type InteractiveSessionProvenanceResolution =
  | { status: "absent" }
  | { status: "valid"; provenance: InteractiveSessionProvenance }
  | { status: "invalid" };

function isSha256Digest(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

/**
 * Role-neutral access to interactive-session provenance.
 *
 * B.4.1 deliberately preserves the admin_session_provenance table. Consumers
 * depend on this API rather than its historical storage name so a later
 * additive storage migration does not affect principal resolution.
 */
export async function getInteractiveSessionProvenance(
  sessionId: string,
): Promise<InteractiveSessionProvenanceResolution> {
  let rows;
  try {
    rows = await db.select({
      authenticationMethod: adminSessionProvenance.authenticationMethod,
      subjectHash: adminSessionProvenance.vibySubjectHash,
      operation: adminSessionProvenance.operation,
      verificationKind: adminSessionProvenance.verificationKind,
      verifiedAt: adminSessionProvenance.verifiedAt,
      providerId: vibyIdentityLinks.providerId,
      displayName: vibyIdentityLinks.displayName,
      linkStatus: vibyIdentityLinks.status,
      linkRevokedAt: vibyIdentityLinks.revokedAt,
    }).from(adminSessionProvenance)
      .leftJoin(
        vibyIdentityLinks,
        eq(adminSessionProvenance.identityLinkId, vibyIdentityLinks.id),
      )
      .where(eq(adminSessionProvenance.sessionId, sessionId))
      .limit(2);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/no such table.*admin_session_provenance/i.test(message)) {
      return { status: "absent" };
    }
    throw error;
  }

  if (rows.length === 0) return { status: "absent" };
  if (rows.length !== 1) return { status: "invalid" };

  const row = rows[0];
  if (
    row.authenticationMethod !== "better_auth_viby"
    || row.providerId !== "viby"
    || !row.displayName?.trim()
    || (row.linkStatus !== "active" && row.linkStatus !== "revoked")
    || !isSha256Digest(row.subjectHash)
    || !["application_login", "admin_login", "judge_login"].includes(row.operation ?? "")
    || (row.verificationKind !== null
      && row.verificationKind !== "fresh"
      && row.verificationKind !== "remembered")
  ) {
    return { status: "invalid" };
  }

  return {
    status: "valid",
    provenance: {
      authenticationMethod: row.authenticationMethod,
      operation: row.operation,
      verificationKind: row.verificationKind,
      verifiedAt: row.verifiedAt,
      linkedRuntimeIdentity: {
        provider: "viby",
        displayName: row.displayName,
        status: row.linkStatus,
        revokedAt: row.linkRevokedAt,
      },
    },
  };
}

export async function recordInteractiveSessionProvenance(input: {
  sessionId: string;
  identityLinkId: string;
  vibySubjectHash: string;
  operation: VibyLoginOperation;
  verificationKind: "fresh" | "remembered";
  verifiedAt: Date;
}) {
  if (!isSha256Digest(input.vibySubjectHash)) {
    throw new Error("Interactive session provenance requires a subject digest.");
  }

  const now = new Date();
  db.transaction((tx: typeof db) => {
    recordInteractiveSessionProvenanceInTransaction(tx, input, now);
    tx.update(vibyIdentityLinks)
      .set({ lastAuthenticatedAt: now, updatedAt: now })
      .where(eq(vibyIdentityLinks.id, input.identityLinkId))
      .run();
  });
}

export function recordInteractiveSessionProvenanceInTransaction(
  tx: typeof db,
  input: {
    sessionId: string;
    identityLinkId: string;
    vibySubjectHash: string;
    operation: VibyLoginOperation;
    verificationKind: "fresh" | "remembered";
    verifiedAt: Date;
  },
  createdAt: Date,
  options: { ignoreExisting?: boolean } = {},
) {
  if (!isSha256Digest(input.vibySubjectHash)) {
    throw new Error("Interactive session provenance requires a subject digest.");
  }
  const insert = tx.insert(adminSessionProvenance).values({
    id: nanoid(),
    sessionId: input.sessionId,
    authenticationMethod: "better_auth_viby",
    identityLinkId: input.identityLinkId,
    vibySubjectHash: input.vibySubjectHash,
    operation: input.operation,
    verificationKind: input.verificationKind,
    verifiedAt: input.verifiedAt,
    createdAt,
  });
  if (options.ignoreExisting) {
    insert.onConflictDoNothing().run();
    return;
  }
  insert.run();
}
