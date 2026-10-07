import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  vibyIdentityLinks,
  vibyIdentityLinkTransactions,
  vibyLegacyIdentityClaims,
} from "@/lib/db/schema";
import {
  recordInteractiveSessionProvenanceInTransaction,
} from "@/lib/interactive-session-provenance";
import { sha256 } from "@/lib/viby-login-transactions";
import {
  safeVibyReturnTo,
  type VibyLoginOperation,
} from "@/lib/viby-login-policy";

const LINK_TTL_MS = 10 * 60 * 1000;
export const VIBY_LINK_TOKEN_COOKIE = "vibe_viby_link_token";
export const VIBY_LINK_BINDING_COOKIE = "vibe_viby_link_binding";
export const MAX_LINKING_BETTER_AUTH_SESSION_AGE_MS = 10 * 60 * 1000;

export function isRecentLinkingBetterAuthSession(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= MAX_LINKING_BETTER_AUTH_SESSION_AGE_MS;
}

type IdentityLinkRow = typeof vibyIdentityLinks.$inferSelect;
export type VibyIdentityClassification =
  | { kind: "bound_active"; link: IdentityLinkRow }
  | { kind: "unbound_legacy_claimable"; link: IdentityLinkRow }
  | { kind: "revoked"; link: IdentityLinkRow }
  | { kind: "conflict"; link?: IdentityLinkRow }
  | { kind: "ambiguous" }
  | { kind: "absent" };

export function classifyVibyIdentityRows(
  rows: IdentityLinkRow[],
  input: { subject: string; applicationId: string; environment: string },
): VibyIdentityClassification {
  if (rows.length === 0) return { kind: "absent" };
  if (rows.length !== 1) return { kind: "ambiguous" };
  const link = rows[0];
  if (
    link.providerId !== "viby"
    || link.subjectId !== input.subject
    || link.applicationId !== input.applicationId
    || link.role !== "admin"
    || (link.linkScope !== "legacy_admin" && link.linkScope !== "identity")
  ) return { kind: "conflict", link };
  if (link.status === "revoked" || link.revokedAt) return { kind: "revoked", link };
  if (link.status !== "active") return { kind: "ambiguous" };
  if (link.localUserId) {
    if (link.environment && link.environment !== input.environment) return { kind: "conflict", link };
    return { kind: "bound_active", link };
  }
  const recognizedLegacyState = link.linkProvenance === "operator"
    && !link.bindingProvenance
    && !link.boundAt
    && (!link.environment || link.environment === input.environment);
  return recognizedLegacyState
    ? { kind: "unbound_legacy_claimable", link }
    : { kind: "ambiguous" };
}

export async function classifyVibyIdentity(input: {
  subject: string;
  applicationId: string;
  environment: string;
}) {
  const rows = await db.select().from(vibyIdentityLinks).where(and(
    eq(vibyIdentityLinks.providerId, "viby"),
    eq(vibyIdentityLinks.subjectId, input.subject),
  ));
  return classifyVibyIdentityRows(rows, input);
}

export async function createPendingVibyLink(input: {
  operation?: VibyLoginOperation;
  subject: string;
  identitySessionId: string;
  verifiedAt: string;
  assertionId: string;
  returnTo: string;
  environment: string;
  classification: Extract<VibyIdentityClassification, { kind: "absent" | "unbound_legacy_claimable" }>;
  expectedUserId?: string;
}) {
  const operation = input.operation ?? "admin_login";
  const token = randomBytes(32).toString("base64url");
  const browserBinding = randomBytes(32).toString("base64url");
  const now = new Date();
  const transaction = db.transaction((tx: typeof db) => {
    const id = nanoid();
    const transactionType = input.classification.kind === "unbound_legacy_claimable"
      ? "claim_unbound_legacy_link" as const
      : "create_new_link" as const;
    const [created] = tx.insert(vibyIdentityLinkTransactions).values({
      id,
      tokenHash: sha256(token),
      browserBindingHash: sha256(browserBinding),
      vibySubject: input.subject,
      vibySubjectHash: sha256(input.subject),
      applicationId: "vibe-hackathon",
      environment: input.environment,
      identitySessionId: input.identitySessionId,
      verifiedAt: new Date(input.verifiedAt),
      assertionCorrelationHash: sha256(input.assertionId),
      expectedUserId: input.expectedUserId,
      returnTo: safeVibyReturnTo(operation, input.returnTo),
      operation,
      transactionType,
      status: "pending",
      createdAt: now,
      expiresAt: new Date(now.getTime() + LINK_TTL_MS),
    }).returning().all();
    if (input.classification.kind === "unbound_legacy_claimable") {
      tx.insert(vibyLegacyIdentityClaims).values({
        transactionId: id,
        identityLinkId: input.classification.link.id,
        expectedStatus: "active",
        expectedUserUnbound: true,
        expectedApplicationId: "vibe-hackathon",
        expectedEnvironment: input.environment,
        expectedSubjectHash: sha256(input.subject),
        createdAt: now,
      }).run();
    }
    return created;
  });
  return { transaction, token, browserBinding };
}

export async function preparePendingVibyLink(input: {
  operation?: VibyLoginOperation;
  token: string;
  browserBinding: string;
  userId: string;
}) {
  const operation = input.operation ?? "admin_login";
  const now = new Date();
  const [transaction] = await db.update(vibyIdentityLinkTransactions).set({
    expectedUserId: input.userId,
    attemptCount: 1,
  }).where(and(
    eq(vibyIdentityLinkTransactions.tokenHash, sha256(input.token)),
    eq(vibyIdentityLinkTransactions.browserBindingHash, sha256(input.browserBinding)),
    eq(vibyIdentityLinkTransactions.operation, operation),
    eq(vibyIdentityLinkTransactions.status, "pending"),
    gt(vibyIdentityLinkTransactions.expiresAt, now),
    isNull(vibyIdentityLinkTransactions.expectedUserId),
  )).returning();
  if (transaction) return transaction;
  const [existing] = await db.select().from(vibyIdentityLinkTransactions).where(and(
    eq(vibyIdentityLinkTransactions.tokenHash, sha256(input.token)),
    eq(vibyIdentityLinkTransactions.browserBindingHash, sha256(input.browserBinding)),
    eq(vibyIdentityLinkTransactions.operation, operation),
    eq(vibyIdentityLinkTransactions.status, "pending"),
    eq(vibyIdentityLinkTransactions.expectedUserId, input.userId),
    gt(vibyIdentityLinkTransactions.expiresAt, now),
  )).limit(1);
  if (existing) return existing;
  await db.update(vibyIdentityLinkTransactions).set({
    status: "failed",
    failureCode: "account_changed",
  }).where(and(
    eq(vibyIdentityLinkTransactions.tokenHash, sha256(input.token)),
    eq(vibyIdentityLinkTransactions.browserBindingHash, sha256(input.browserBinding)),
    eq(vibyIdentityLinkTransactions.operation, operation),
    eq(vibyIdentityLinkTransactions.status, "pending"),
    gt(vibyIdentityLinkTransactions.expiresAt, now),
  ));
  return null;
}

export async function confirmPendingVibyLink(input: {
  operation?: VibyLoginOperation;
  token: string;
  browserBinding: string;
  userId: string;
  betterAuthSessionId?: string;
}) {
  const operation = input.operation ?? "admin_login";
  return db.transaction((tx: typeof db) => {
    const now = new Date();
    const [pending] = tx.select().from(vibyIdentityLinkTransactions).where(and(
      eq(vibyIdentityLinkTransactions.tokenHash, sha256(input.token)),
      eq(vibyIdentityLinkTransactions.browserBindingHash, sha256(input.browserBinding)),
      eq(vibyIdentityLinkTransactions.operation, operation),
      eq(vibyIdentityLinkTransactions.expectedUserId, input.userId),
      eq(vibyIdentityLinkTransactions.status, "pending"),
      gt(vibyIdentityLinkTransactions.expiresAt, now),
      isNull(vibyIdentityLinkTransactions.consumedAt),
    )).limit(1).all();
    if (!pending) return { ok: false as const, reason: "invalid_transaction" as const };

    const subjectRows = tx.select().from(vibyIdentityLinks).where(and(
      eq(vibyIdentityLinks.providerId, "viby"),
      eq(vibyIdentityLinks.subjectId, pending.vibySubject),
    )).all();
    const classification = classifyVibyIdentityRows(subjectRows, {
      subject: pending.vibySubject,
      applicationId: pending.applicationId,
      environment: pending.environment,
    });
    const subjectConflict = "link" in classification ? classification.link : undefined;
    if (classification.kind === "ambiguous") {
      tx.update(vibyIdentityLinkTransactions).set({ status: "failed", failureCode: "ambiguous_link" }).where(eq(vibyIdentityLinkTransactions.id, pending.id)).run();
      return { ok: false as const, reason: "ambiguous_link" as const };
    }
    if (subjectConflict) {
      if (classification.kind === "revoked") {
        tx.update(vibyIdentityLinkTransactions).set({ status: "failed", failureCode: "revoked_link" }).where(eq(vibyIdentityLinkTransactions.id, pending.id)).run();
        return { ok: false as const, reason: "revoked_link" as const };
      }
      if (classification.kind === "conflict") {
        tx.update(vibyIdentityLinkTransactions).set({ status: "failed", failureCode: "ambiguous_link" }).where(eq(vibyIdentityLinkTransactions.id, pending.id)).run();
        return { ok: false as const, reason: "ambiguous_link" as const };
      }
      if (classification.kind === "bound_active" && subjectConflict.localUserId !== input.userId) {
        tx.update(vibyIdentityLinkTransactions).set({ status: "failed", failureCode: "subject_conflict" }).where(eq(vibyIdentityLinkTransactions.id, pending.id)).run();
        return { ok: false as const, reason: "subject_conflict" as const };
      }
    }
    const [userConflict] = tx.select().from(vibyIdentityLinks).where(and(
      eq(vibyIdentityLinks.applicationId, pending.applicationId),
      eq(vibyIdentityLinks.localUserId, input.userId),
    )).limit(1).all();
    if (userConflict && userConflict.id !== subjectConflict?.id) {
      tx.update(vibyIdentityLinkTransactions).set({ status: "failed", failureCode: "user_conflict" }).where(eq(vibyIdentityLinkTransactions.id, pending.id)).run();
      return { ok: false as const, reason: "user_conflict" as const };
    }

    let link: IdentityLinkRow;
    let idempotent = false;
    if (pending.transactionType === "claim_unbound_legacy_link") {
      const [claim] = tx.select().from(vibyLegacyIdentityClaims)
        .where(eq(vibyLegacyIdentityClaims.transactionId, pending.id)).limit(1).all();
      const exactConcurrentResult = classification.kind === "bound_active"
        && classification.link.id === claim?.identityLinkId
        && classification.link.localUserId === input.userId
        && classification.link.applicationId === pending.applicationId
        && classification.link.environment === pending.environment
        && classification.link.subjectId === pending.vibySubject
        && classification.link.bindingProvenance === "interactive_legacy_claim";
      if (
        !claim
        || claim.expectedApplicationId !== pending.applicationId
        || claim.expectedEnvironment !== pending.environment
        || claim.expectedSubjectHash !== pending.vibySubjectHash
        || (!exactConcurrentResult && (
          classification.kind !== "unbound_legacy_claimable"
          || classification.link.id !== claim.identityLinkId
        ))
      ) {
        tx.update(vibyIdentityLinkTransactions).set({ status: "failed", failureCode: "legacy_row_changed" })
          .where(eq(vibyIdentityLinkTransactions.id, pending.id)).run();
        return { ok: false as const, reason: "legacy_row_changed" as const };
      }
      if (exactConcurrentResult) {
        link = classification.link;
        idempotent = true;
      } else {
        const claimed = tx.update(vibyIdentityLinks).set({
          localUserId: input.userId,
          environment: pending.environment,
          bindingProvenance: "interactive_legacy_claim",
          boundAt: now,
          lastVerifiedAt: pending.verifiedAt,
          lastAuthenticatedAt: now,
          updatedAt: now,
        }).where(and(
          eq(vibyIdentityLinks.id, claim.identityLinkId),
          eq(vibyIdentityLinks.providerId, "viby"),
          eq(vibyIdentityLinks.subjectId, pending.vibySubject),
          eq(vibyIdentityLinks.applicationId, pending.applicationId),
          eq(vibyIdentityLinks.status, "active"),
          isNull(vibyIdentityLinks.revokedAt),
          isNull(vibyIdentityLinks.localUserId),
          isNull(vibyIdentityLinks.bindingProvenance),
        )).returning().all();
        if (claimed.length !== 1) return { ok: false as const, reason: "concurrent_claim_lost" as const };
        link = claimed[0];
      }
    } else {
      if (classification.kind === "bound_active") {
        link = classification.link;
        idempotent = true;
      } else if (classification.kind === "absent") {
        [link] = tx.insert(vibyIdentityLinks).values({
          id: nanoid(),
          providerId: "viby",
          subjectId: pending.vibySubject,
          role: "admin",
          linkScope: "identity",
          localUserId: input.userId,
          applicationId: pending.applicationId,
          status: "active",
          linkProvenance: "interactive_fresh_verification",
          environment: pending.environment,
          bindingProvenance: "interactive_fresh_verification",
          boundAt: now,
          displayName: "Verified Viby identity",
          lastVerifiedAt: pending.verifiedAt,
          lastAuthenticatedAt: now,
          createdAt: now,
          updatedAt: now,
        }).returning().all();
      } else {
        return { ok: false as const, reason: "subject_conflict" as const };
      }
    }

    const consumed = tx.update(vibyIdentityLinkTransactions).set({
      status: "confirmed",
      consumedAt: now,
      attemptCount: 2,
    }).where(and(
      eq(vibyIdentityLinkTransactions.id, pending.id),
      eq(vibyIdentityLinkTransactions.status, "pending"),
      isNull(vibyIdentityLinkTransactions.consumedAt),
    )).returning().all();
    if (consumed.length !== 1) return { ok: false as const, reason: "invalid_transaction" as const };
    if (input.betterAuthSessionId) {
      recordInteractiveSessionProvenanceInTransaction(tx, {
        sessionId: input.betterAuthSessionId,
        identityLinkId: link.id,
        vibySubjectHash: pending.vibySubjectHash,
        operation,
        verificationKind: "fresh",
        verifiedAt: pending.verifiedAt,
      }, now, { ignoreExisting: true });
    }
    return {
      ok: true as const,
      link,
      returnTo: pending.returnTo,
      idempotent,
      claimType: pending.transactionType,
    };
  });
}

export async function cancelPendingVibyLink(
  token: string,
  browserBinding: string,
  operation: VibyLoginOperation = "admin_login",
) {
  const rows = await db.update(vibyIdentityLinkTransactions).set({
    status: "cancelled",
    cancelledAt: new Date(),
  }).where(and(
    eq(vibyIdentityLinkTransactions.tokenHash, sha256(token)),
    eq(vibyIdentityLinkTransactions.browserBindingHash, sha256(browserBinding)),
    eq(vibyIdentityLinkTransactions.operation, operation),
    eq(vibyIdentityLinkTransactions.status, "pending"),
  )).returning();
  return rows.length === 1;
}
