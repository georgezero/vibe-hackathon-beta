import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  users,
  vibyIdentityLinks,
  vibyLoginTransactions,
  vibySessionHandoffs,
} from "@/lib/db/schema";
import {
  isVibyLoginOperation,
  safeVibyReturnTo,
  type VibyLoginOperation,
} from "@/lib/viby-login-policy";

const LOGIN_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 60 * 1000;
export const VIBY_BROWSER_BINDING_COOKIE = "vibe_viby_login_binding";
export const VIBY_HANDOFF_COOKIE = "vibe_viby_session_handoff";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function safeAdminReturnTo(value: string | null | undefined) {
  return safeVibyReturnTo("admin_login", value);
}

export async function createVibyLoginTransaction(input: {
  operation?: VibyLoginOperation;
  returnTo?: string | null;
  expectedAudience: string;
  freshnessRequired: boolean;
}) {
  const operation = input.operation ?? "admin_login";
  const state = randomBytes(32).toString("base64url");
  const browserBinding = randomBytes(32).toString("base64url");
  const now = new Date();
  const transaction = {
    id: nanoid(),
    stateHash: sha256(state),
    browserBindingHash: sha256(browserBinding),
    operation,
    returnTo: safeVibyReturnTo(operation, input.returnTo),
    expectedAudience: input.expectedAudience,
    freshnessRequired: input.freshnessRequired,
    createdAt: now,
    expiresAt: new Date(now.getTime() + LOGIN_TTL_MS),
  };
  await db.delete(vibyLoginTransactions).where(lt(vibyLoginTransactions.expiresAt, now));
  await db.insert(vibyLoginTransactions).values(transaction);
  return { transaction, state, browserBinding };
}

export async function consumeVibyLoginTransaction(input: {
  state: string;
  browserBinding: string;
}) {
  const now = new Date();
  const rows = await db.update(vibyLoginTransactions)
    .set({ consumedAt: now })
    .where(and(
      eq(vibyLoginTransactions.stateHash, sha256(input.state)),
      eq(vibyLoginTransactions.browserBindingHash, sha256(input.browserBinding)),
      isNull(vibyLoginTransactions.consumedAt),
      gt(vibyLoginTransactions.expiresAt, now),
    ))
    .returning();
  return rows.length === 1 ? rows[0] : null;
}

export async function inspectVibyLoginTransactionState(state: string) {
  if (!state) {
    return { found: false as const, operation: null };
  }
  const rows = await db.select({ operation: vibyLoginTransactions.operation })
    .from(vibyLoginTransactions)
    .where(eq(vibyLoginTransactions.stateHash, sha256(state)))
    .limit(2);
  if (rows.length !== 1) {
    return { found: rows.length > 0, operation: null };
  }
  return {
    found: true as const,
    operation: isVibyLoginOperation(rows[0].operation)
      ? rows[0].operation
      : null,
  };
}

export async function activeVibyUserLink(subjectId: string) {
  const rows = await db.select({
    link: vibyIdentityLinks,
    user: users,
  }).from(vibyIdentityLinks)
    .innerJoin(users, eq(vibyIdentityLinks.localUserId, users.id))
    .where(and(
      eq(vibyIdentityLinks.providerId, "viby"),
      eq(vibyIdentityLinks.applicationId, "vibe-hackathon"),
      eq(vibyIdentityLinks.subjectId, subjectId),
      eq(vibyIdentityLinks.status, "active"),
      isNull(vibyIdentityLinks.revokedAt),
    ))
    .limit(1);
  return rows[0] ?? null;
}

export async function createVibySessionHandoff(input: {
  operation?: VibyLoginOperation;
  transactionId: string;
  identityLinkId: string;
  userId: string;
  vibySubject: string;
  returnTo: string;
  verificationKind: "fresh" | "remembered";
  verifiedAt: string;
}) {
  const operation = input.operation ?? "admin_login";
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(vibySessionHandoffs).values({
    id: nanoid(),
    tokenHash: sha256(token),
    transactionId: input.transactionId,
    identityLinkId: input.identityLinkId,
    userId: input.userId,
    vibySubjectHash: sha256(input.vibySubject),
    operation,
    returnTo: safeVibyReturnTo(operation, input.returnTo),
    verificationKind: input.verificationKind,
    verifiedAt: new Date(input.verifiedAt),
    createdAt: now,
    expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS),
  });
  return token;
}

export async function consumeVibySessionHandoff(token: string) {
  const now = new Date();
  const rows = await db.update(vibySessionHandoffs)
    .set({ consumedAt: now })
    .where(and(
      eq(vibySessionHandoffs.tokenHash, sha256(token)),
      isNull(vibySessionHandoffs.consumedAt),
      gt(vibySessionHandoffs.expiresAt, now),
    ))
    .returning();
  if (rows.length !== 1) return null;
  const handoff = rows[0];
  if (
    !["application_login", "admin_login", "judge_login"].includes(handoff.operation)
    || (handoff.verificationKind !== "fresh" && handoff.verificationKind !== "remembered")
    || !handoff.verifiedAt
  ) {
    return null;
  }
  const [parent] = await db.select({ id: vibyLoginTransactions.id })
    .from(vibyLoginTransactions)
    .where(and(
      eq(vibyLoginTransactions.id, handoff.transactionId),
      eq(vibyLoginTransactions.operation, handoff.operation),
    ))
    .limit(1);
  if (!parent) return null;
  const linked = await db.select({
    link: vibyIdentityLinks,
    user: users,
  }).from(vibyIdentityLinks)
    .innerJoin(users, eq(vibyIdentityLinks.localUserId, users.id))
    .where(and(
      eq(vibyIdentityLinks.id, handoff.identityLinkId),
      eq(vibyIdentityLinks.localUserId, handoff.userId),
      eq(vibyIdentityLinks.status, "active"),
      isNull(vibyIdentityLinks.revokedAt),
    ))
    .limit(1);
  return linked.length === 1 ? { handoff, ...linked[0] } : null;
}
