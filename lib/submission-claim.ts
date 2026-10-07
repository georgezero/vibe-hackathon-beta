import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  auditEvents,
  submissionClaimTransactions,
  submissionMemberships,
  submissionOwners,
  submissions,
} from "@/lib/db/schema";

export const SUBMISSION_CLAIM_COOKIE = "vibe_submission_claim";
export const SUBMISSION_CLAIM_BINDING_COOKIE = "vibe_submission_claim_binding";
const CLAIM_TTL_SECONDS = 10 * 60;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function binding() {
  return randomBytes(32).toString("base64url");
}

export function claimCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: CLAIM_TTL_SECONDS,
  };
}

export async function beginSubmissionClaim(input: {
  submissionId: string;
  editToken: string;
  headers: Headers;
}) {
  const row = await db.select({ id: submissions.id, editToken: submissions.editToken, teamName: submissions.teamName })
    .from(submissions).where(eq(submissions.id, input.submissionId)).limit(1);
  const submission = row[0];
  if (!submission || submission.editToken !== input.editToken) {
    await db.insert(auditEvents).values({
      id: nanoid(), entityType: "submission", entityId: input.submissionId,
      action: "submission_claim_denied", actorType: "team", actorId: null,
      metadata: { reason: "invalid_proof" } as unknown as Record<string, unknown>, createdAt: new Date(),
    });
    return { ok: false as const, reason: "invalid_proof" as const };
  }
  const existing = await db.select({ userId: submissionOwners.userId })
    .from(submissionOwners).where(eq(submissionOwners.submissionId, input.submissionId)).limit(1);
  if (existing[0]) {
    await db.insert(auditEvents).values({
      id: nanoid(), entityType: "submission", entityId: input.submissionId,
      action: "submission_claim_denied", actorType: "team", actorId: null,
      metadata: { reason: "already_claimed" } as unknown as Record<string, unknown>, createdAt: new Date(),
    });
    return { ok: false as const, reason: "already_claimed" as const };
  }

  const current = await auth.api.getSession({ headers: input.headers });
  const id = `claim_${nanoid(16)}`;
  const browserBinding = binding();
  const now = new Date();
  await db.insert(submissionClaimTransactions).values({
    id,
    submissionId: input.submissionId,
    editTokenHash: digest(input.editToken),
    browserBindingHash: digest(browserBinding),
    userId: current?.user.id ?? null,
    status: "pending",
    expiresAt: new Date(now.getTime() + CLAIM_TTL_SECONDS * 1000),
    createdAt: now,
  });
  await db.insert(auditEvents).values({
    id: nanoid(), entityType: "submission", entityId: input.submissionId,
    action: "submission_claim_started", actorType: current?.user.id ? "user" : "team",
    actorId: current?.user.id ?? null,
    metadata: { transactionId: id } as unknown as Record<string, unknown>, createdAt: now,
  });
  return { ok: true as const, transactionId: id, browserBinding, userId: current?.user.id ?? null, teamName: submission.teamName };
}

export async function getPendingSubmissionClaim(input: {
  transactionId: string;
  browserBinding: string;
  headers: Headers;
}) {
  const rows = await db.select({
    transaction: submissionClaimTransactions,
    submission: submissions,
  }).from(submissionClaimTransactions)
    .innerJoin(submissions, eq(submissions.id, submissionClaimTransactions.submissionId))
    .where(and(
      eq(submissionClaimTransactions.id, input.transactionId),
      eq(submissionClaimTransactions.browserBindingHash, digest(input.browserBinding)),
      eq(submissionClaimTransactions.status, "pending"),
    )).limit(1);
  const row = rows[0];
  if (!row) return { ok: false as const, reason: "invalid_transaction" as const };
  if (row.transaction.expiresAt.getTime() <= Date.now()) {
    await db.update(submissionClaimTransactions).set({ status: "expired" }).where(eq(submissionClaimTransactions.id, input.transactionId));
    return { ok: false as const, reason: "expired" as const };
  }
  const session = await auth.api.getSession({ headers: input.headers });
  if (!session?.user) return { ok: false as const, reason: "authentication_required" as const };
  if (row.transaction.userId && row.transaction.userId !== session.user.id) {
    return { ok: false as const, reason: "account_changed" as const };
  }
  return { ok: true as const, transaction: row.transaction, submission: row.submission, user: session.user };
}

export async function confirmSubmissionClaim(input: {
  transactionId: string;
  browserBinding: string;
  headers: Headers;
}) {
  const pending = await getPendingSubmissionClaim(input);
  if (!pending.ok) return pending;
  const now = new Date();
  const ownerRows = await db.select({ userId: submissionOwners.userId })
    .from(submissionOwners).where(eq(submissionOwners.submissionId, pending.submission.id)).limit(1);
  if (ownerRows[0] && ownerRows[0].userId !== pending.user.id) {
    return { ok: false as const, reason: "already_claimed" as const };
  }
  db.transaction((tx: typeof db) => {
    if (!ownerRows[0]) {
      tx.insert(submissionOwners).values({
        id: `owner_${nanoid(12)}`,
        submissionId: pending.submission.id,
        userId: pending.user.id,
        createdAt: now,
      }).run();
    }
    const activeOwner = tx.select({ id: submissionMemberships.id, userId: submissionMemberships.userId })
      .from(submissionMemberships).where(and(
        eq(submissionMemberships.submissionId, pending.submission.id),
        eq(submissionMemberships.role, "owner"),
        eq(submissionMemberships.status, "active"),
      )).limit(2).all();
    if (activeOwner.length > 1 || (activeOwner[0] && activeOwner[0].userId !== pending.user.id)) {
      throw new Error("submission_owner_membership_conflict");
    }
    if (!activeOwner[0]) {
      tx.insert(submissionMemberships).values({
        id: `membership_owner_${nanoid(16)}`,
        submissionId: pending.submission.id,
        userId: pending.user.id,
        role: "owner",
        status: "active",
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
    tx.update(submissionClaimTransactions).set({
      status: "confirmed", userId: pending.user.id, confirmedAt: now,
    }).where(eq(submissionClaimTransactions.id, input.transactionId)).run();
    tx.insert(auditEvents).values({
      id: nanoid(), entityType: "submission", entityId: pending.submission.id,
      action: "submission_claim_confirmed", actorType: "user", actorId: pending.user.id,
      metadata: { transactionId: input.transactionId } as unknown as Record<string, unknown>, createdAt: now,
    }).run();
  });
  return { ok: true as const, submission: pending.submission, user: pending.user };
}
