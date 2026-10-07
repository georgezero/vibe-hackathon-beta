import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  accounts,
  accountInvitations,
  adminAuthorizations,
  auditEvents,
  events,
  judgeAuthorizations,
  judges,
  userAccountControls,
  users,
} from "@/lib/db/schema";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCOUNT_INVITATION_COOKIE = "vibe_account_invitation";

export type InvitationLifecycle = "pending" | "accepted" | "expired" | "revoked";

export type InvitationErrorCode =
  | "invalid_name"
  | "invalid_email"
  | "email_conflict"
  | "invitation_not_found"
  | "invitation_expired"
  | "invitation_consumed"
  | "judge_profile_required"
  | "judge_profile_unavailable"
  | "event_not_found"
  | "credential_state_conflict"
  | "authorization_conflict"
  | "account_unavailable";

export class InvitationError extends Error {
  constructor(public readonly code: InvitationErrorCode) {
    super(code);
    this.name = "InvitationError";
  }
}

function normalizeName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) throw new InvitationError("invalid_name");
  return name;
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new InvitationError("invalid_email");
  }
  return email;
}

export function invitationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateInvitationToken() {
  return randomBytes(32).toString("base64url");
}

function lifecycle(row: { status: "pending" | "accepted" | "expired" | "revoked"; expiresAt: Date }, now = new Date()): InvitationLifecycle {
  if (row.status === "accepted") return "accepted";
  if (row.status === "expired") return "expired";
  if (row.status === "revoked") return "revoked";
  return row.expiresAt.getTime() <= now.getTime() ? "expired" : "pending";
}

function audit(tx: typeof db, input: {
  action: string;
  actorUserId: string | null;
  userId: string;
  invitationId: string;
  result?: string;
}) {
  tx.insert(auditEvents).values({
    id: nanoid(),
    entityType: "account_invitation",
    entityId: input.invitationId,
    action: input.action,
    actorType: input.actorUserId ? "user" : "invited_user",
    actorId: input.actorUserId,
    metadata: {
      targetUserId: input.userId,
      result: input.result ?? "succeeded",
    },
    createdAt: new Date(),
  }).run();
}

function validateIntent(tx: typeof db, input: {
  grantJudge: boolean;
  judgeProfileId?: string | null;
  eventId: string;
}) {
  if (!tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId)).limit(1).all()[0]) {
    throw new InvitationError("event_not_found");
  }
  if (!input.grantJudge) return null;
  if (!input.judgeProfileId) throw new InvitationError("judge_profile_required");
  if (!tx.select({ id: judges.id }).from(judges).where(eq(judges.id, input.judgeProfileId)).limit(1).all()[0]) {
    throw new InvitationError("judge_profile_required");
  }
  const active = tx.select({ id: judgeAuthorizations.id }).from(judgeAuthorizations).where(and(
    eq(judgeAuthorizations.judgeId, input.judgeProfileId),
    eq(judgeAuthorizations.eventId, input.eventId),
    eq(judgeAuthorizations.status, "active"),
    isNull(judgeAuthorizations.revokedAt),
  )).limit(1).all()[0];
  const reserved = tx.select({ id: accountInvitations.id }).from(accountInvitations).where(and(
    eq(accountInvitations.judgeProfileId, input.judgeProfileId),
    eq(accountInvitations.eventId, input.eventId),
    eq(accountInvitations.status, "pending"),
    gt(accountInvitations.expiresAt, new Date()),
  )).limit(1).all()[0];
  if (active || reserved) throw new InvitationError("judge_profile_unavailable");
  return input.judgeProfileId;
}

export function createAccountInvitation(input: {
  actorUserId: string;
  name: string;
  email: string;
  grantAdmin: boolean;
  grantJudge: boolean;
  judgeProfileId?: string | null;
  eventId: string;
}) {
  const name = normalizeName(input.name);
  const email = normalizeEmail(input.email);
  const token = generateInvitationToken();
  const now = new Date();
  const userId = nanoid(24);
  const invitationId = nanoid(24);
  db.transaction((tx: typeof db) => {
    tx.update(accountInvitations).set({ status: "expired", expiredAt: now, updatedAt: now }).where(and(
      eq(accountInvitations.status, "pending"),
      lt(accountInvitations.expiresAt, now),
    )).run();
    if (tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).all()[0]) {
      throw new InvitationError("email_conflict");
    }
    const judgeProfileId = validateIntent(tx, input);
    tx.insert(users).values({ id: userId, name, email, emailVerified: false, createdAt: now, updatedAt: now }).run();
    tx.insert(userAccountControls).values({
      userId,
      status: "active",
      passwordChangeRequired: false,
      createdAt: now,
      updatedAt: now,
    }).run();
    tx.insert(accountInvitations).values({
      id: invitationId,
      userId,
      tokenHash: invitationTokenHash(token),
      status: "pending",
      grantAdmin: input.grantAdmin,
      grantJudge: input.grantJudge,
      judgeProfileId,
      eventId: input.eventId,
      invitedByUserId: input.actorUserId,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      createdAt: now,
      updatedAt: now,
    }).run();
    audit(tx, { action: "account_invitation_created", actorUserId: input.actorUserId, userId, invitationId });
  });
  return { invitationId, userId, token, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS) };
}

export async function inspectAccountInvitation(token: string) {
  if (!token || token.length < 32) return null;
  const rows = await db.select({
    id: accountInvitations.id,
    userId: accountInvitations.userId,
    status: accountInvitations.status,
    grantAdmin: accountInvitations.grantAdmin,
    grantJudge: accountInvitations.grantJudge,
    judgeProfileId: accountInvitations.judgeProfileId,
    eventId: accountInvitations.eventId,
    expiresAt: accountInvitations.expiresAt,
    acceptedAt: accountInvitations.acceptedAt,
    revokedAt: accountInvitations.revokedAt,
    createdAt: accountInvitations.createdAt,
    userName: users.name,
    userEmail: users.email,
  }).from(accountInvitations)
    .innerJoin(users, eq(users.id, accountInvitations.userId))
    .where(eq(accountInvitations.tokenHash, invitationTokenHash(token)))
    .limit(2);
  if (rows.length !== 1) return null;
  return { ...rows[0], lifecycle: lifecycle(rows[0]) };
}

function applyAccessIntent(tx: typeof db, invitation: typeof accountInvitations.$inferSelect, now: Date) {
  if (invitation.grantAdmin) {
    const rows = tx.select().from(adminAuthorizations).where(eq(adminAuthorizations.userId, invitation.userId)).limit(2).all();
    if (rows.length > 1) throw new InvitationError("authorization_conflict");
    if (!rows.length) {
      tx.insert(adminAuthorizations).values({
        id: nanoid(), userId: invitation.userId, status: "active",
        grantSource: `invitation:${invitation.id}`, createdAt: now, updatedAt: now,
      }).run();
    } else if (rows[0].status !== "active" || rows[0].revokedAt) {
      tx.update(adminAuthorizations).set({ status: "active", revokedAt: null, updatedAt: now, grantSource: `invitation:${invitation.id}` })
        .where(eq(adminAuthorizations.id, rows[0].id)).run();
    }
  }
  if (invitation.grantJudge) {
    if (!invitation.judgeProfileId) throw new InvitationError("judge_profile_required");
    const conflicts = tx.select().from(judgeAuthorizations).where(and(
      eq(judgeAuthorizations.eventId, invitation.eventId),
      eq(judgeAuthorizations.status, "active"),
      isNull(judgeAuthorizations.revokedAt),
      or(
        eq(judgeAuthorizations.userId, invitation.userId),
        eq(judgeAuthorizations.judgeId, invitation.judgeProfileId),
      ),
    )).all();
    if ((conflicts as Array<typeof judgeAuthorizations.$inferSelect>).some((row) =>
      row.userId !== invitation.userId || row.judgeId !== invitation.judgeProfileId
    )) {
      throw new InvitationError("authorization_conflict");
    }
    if (!conflicts.length) {
      tx.insert(judgeAuthorizations).values({
        id: nanoid(), userId: invitation.userId, judgeId: invitation.judgeProfileId,
        eventId: invitation.eventId, status: "active",
        grantProvenance: `invitation:${invitation.id}`,
        grantedByUserId: invitation.invitedByUserId,
        invitedAt: invitation.createdAt, acceptedAt: now,
        createdAt: now, updatedAt: now,
      }).run();
    }
  }
}

function requirePendingInvitation(tx: typeof db, token: string, now = new Date()) {
  const rows = tx.select().from(accountInvitations)
    .where(eq(accountInvitations.tokenHash, invitationTokenHash(token))).limit(2).all();
  if (rows.length !== 1) throw new InvitationError("invitation_not_found");
  const invitation = rows[0];
  if (invitation.status !== "pending") throw new InvitationError("invitation_consumed");
  if (invitation.expiresAt.getTime() <= now.getTime()) throw new InvitationError("invitation_expired");
  if (!tx.select({ id: users.id }).from(users).where(eq(users.id, invitation.userId)).limit(1).all()[0]) {
    throw new InvitationError("account_unavailable");
  }
  return invitation;
}

export async function acceptInvitationWithPassword(input: { token: string; password: string }) {
  if (input.password.length < 8 || input.password.length > 128) throw new InvitationError("credential_state_conflict");
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  return db.transaction((tx: typeof db) => {
    const invitation = requirePendingInvitation(tx, input.token, now);
    if (tx.select({ id: accounts.id }).from(accounts).where(and(
      eq(accounts.userId, invitation.userId), eq(accounts.providerId, "credential"),
    )).limit(1).all()[0]) throw new InvitationError("credential_state_conflict");
    tx.insert(accounts).values({
      id: nanoid(), accountId: invitation.userId, providerId: "credential",
      userId: invitation.userId, password: passwordHash, createdAt: now, updatedAt: now,
    }).run();
    tx.update(userAccountControls).set({
      passwordChangeRequired: false, passwordChangedAt: now,
      temporaryPasswordIssuedAt: null, updatedAt: now,
    }).where(eq(userAccountControls.userId, invitation.userId)).run();
    applyAccessIntent(tx, invitation, now);
    tx.update(accountInvitations).set({ status: "accepted", acceptedAt: now, updatedAt: now })
      .where(eq(accountInvitations.id, invitation.id)).run();
    audit(tx, { action: "account_invitation_accepted", actorUserId: null, userId: invitation.userId, invitationId: invitation.id, result: "password" });
    return { userId: invitation.userId, email: tx.select({ email: users.email }).from(users).where(eq(users.id, invitation.userId)).get()!.email };
  });
}

export function acceptInvitationAfterViby(input: { token: string; expectedUserId: string }) {
  const now = new Date();
  return db.transaction((tx: typeof db) => {
    const invitation = requirePendingInvitation(tx, input.token, now);
    if (invitation.userId !== input.expectedUserId) throw new InvitationError("account_unavailable");
    applyAccessIntent(tx, invitation, now);
    tx.update(accountInvitations).set({ status: "accepted", acceptedAt: now, updatedAt: now })
      .where(eq(accountInvitations.id, invitation.id)).run();
    audit(tx, { action: "account_invitation_accepted", actorUserId: null, userId: invitation.userId, invitationId: invitation.id, result: "viby" });
    return invitation;
  });
}

export function manageInvitation(input: {
  actorUserId: string;
  invitationId: string;
  action: "revoke" | "expire" | "regenerate";
}) {
  const now = new Date();
  const token = input.action === "regenerate" ? generateInvitationToken() : null;
  return db.transaction((tx: typeof db) => {
    const rows = tx.select().from(accountInvitations).where(eq(accountInvitations.id, input.invitationId)).limit(2).all();
    if (rows.length !== 1) throw new InvitationError("invitation_not_found");
    const invitation = rows[0];
    if (invitation.status === "accepted") throw new InvitationError("invitation_consumed");
    if (input.action === "revoke") {
      if (invitation.status !== "revoked") tx.update(accountInvitations).set({ status: "revoked", revokedAt: now, updatedAt: now }).where(eq(accountInvitations.id, invitation.id)).run();
    } else if (input.action === "expire") {
      if (invitation.status !== "pending") throw new InvitationError("invitation_consumed");
      tx.update(accountInvitations).set({ status: "expired", expiresAt: now, expiredAt: now, updatedAt: now }).where(eq(accountInvitations.id, invitation.id)).run();
    } else {
      if (invitation.status !== "pending" && invitation.status !== "expired") throw new InvitationError("invitation_consumed");
      tx.update(accountInvitations).set({ status: "pending", tokenHash: invitationTokenHash(token!), expiresAt: new Date(now.getTime() + INVITATION_TTL_MS), expiredAt: null, updatedAt: now })
        .where(eq(accountInvitations.id, invitation.id)).run();
    }
    audit(tx, { action: `account_invitation_${input.action === "regenerate" ? "regenerated" : input.action === "expire" ? "expired" : "revoked"}`, actorUserId: input.actorUserId, userId: invitation.userId, invitationId: invitation.id });
    return { token, userId: invitation.userId, expiresAt: input.action === "regenerate" ? new Date(now.getTime() + INVITATION_TTL_MS) : null };
  });
}

export async function listInvitationSummaries() {
  const rows = await db.select().from(accountInvitations).orderBy(desc(accountInvitations.createdAt));
  return (rows as Array<typeof accountInvitations.$inferSelect>)
    .map((row) => ({ ...row, lifecycle: lifecycle(row) }));
}
