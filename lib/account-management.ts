import { randomBytes } from "node:crypto";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  accounts,
  adminAuthorizations,
  auditEvents,
  events,
  judgeAuthorizations,
  judges,
  sessions,
  userAccountControls,
  users,
} from "@/lib/db/schema";

export const RECENT_ADMIN_AUTHENTICATION_MS = 10 * 60 * 1000;

export function isRecentAdministratorAuthentication(
  createdAt: Date,
  now = new Date(),
) {
  return Number.isFinite(createdAt.getTime())
    && now.getTime() >= createdAt.getTime()
    && now.getTime() - createdAt.getTime() <= RECENT_ADMIN_AUTHENTICATION_MS;
}

export function generateTemporaryPassword() {
  // The prefix guarantees every character class while the random body carries
  // the entropy. The plaintext is returned once and never persisted.
  return `Vh!8${randomBytes(18).toString("base64url")}`;
}

function normalizeName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) {
    throw new AccountManagementError("invalid_name");
  }
  return name;
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (
    email.length > 254
    || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  ) {
    throw new AccountManagementError("invalid_email");
  }
  return email;
}

export type AccountManagementErrorCode =
  | "invalid_name"
  | "invalid_email"
  | "email_conflict"
  | "user_not_found"
  | "judge_profile_required"
  | "judge_profile_unavailable"
  | "event_not_found"
  | "last_administrator"
  | "self_confirmation_required"
  | "authorization_conflict"
  | "credential_state_conflict"
  | "session_not_found";

export class AccountManagementError extends Error {
  constructor(public readonly code: AccountManagementErrorCode) {
    super(code);
    this.name = "AccountManagementError";
  }
}

type AccountAuditAction =
  | "account_created"
  | "account_profile_updated"
  | "account_disabled"
  | "account_enabled"
  | "account_password_reset"
  | "account_password_changed"
  | "account_sessions_revoked"
  | "administrator_access_granted"
  | "administrator_access_revoked"
  | "judge_access_granted"
  | "judge_access_revoked";

function audit(
  tx: typeof db,
  input: {
    action: AccountAuditAction;
    actorUserId: string;
    targetUserId: string;
    eventId?: string | null;
    result?: "succeeded" | "idempotent";
  },
) {
  tx.insert(auditEvents).values({
    id: nanoid(),
    entityType: "user_account",
    entityId: input.targetUserId,
    action: input.action,
    actorType: "user",
    actorId: input.actorUserId,
    metadata: {
      targetUserId: input.targetUserId,
      eventId: input.eventId ?? null,
      result: input.result ?? "succeeded",
    },
    createdAt: new Date(),
  }).run();
}

function requireUser(tx: typeof db, userId: string) {
  const user = tx.select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .all()[0];
  if (!user) throw new AccountManagementError("user_not_found");
}

function ensureControl(tx: typeof db, userId: string, now: Date) {
  tx.insert(userAccountControls).values({
    userId,
    status: "active",
    passwordChangeRequired: false,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoNothing().run();
}

function activeAdministratorCount(tx: typeof db) {
  return Number((tx.select({
    count: sql<number>`count(*)`,
  }).from(adminAuthorizations)
    .leftJoin(
      userAccountControls,
      eq(userAccountControls.userId, adminAuthorizations.userId),
    )
    .where(and(
    eq(adminAuthorizations.status, "active"),
    isNull(adminAuthorizations.revokedAt),
    or(
      isNull(userAccountControls.userId),
      eq(userAccountControls.status, "active"),
    ),
  )).get() as { count: number }).count);
}

function requireSelfConfirmation(
  actorUserId: string,
  targetUserId: string,
  confirmed: boolean,
) {
  if (actorUserId === targetUserId && !confirmed) {
    throw new AccountManagementError("self_confirmation_required");
  }
}

export async function createManagedAccount(input: {
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
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const now = new Date();
  const userId = nanoid(24);
  const result = db.transaction((tx: typeof db) => {
    requireUser(tx, input.actorUserId);
    if (tx.select({ id: users.id }).from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1).all()[0]) {
      throw new AccountManagementError("email_conflict");
    }
    if (!tx.select({ id: events.id }).from(events)
      .where(eq(events.id, input.eventId)).limit(1).all()[0]) {
      throw new AccountManagementError("event_not_found");
    }

    let judgeProfile: { id: string } | undefined;
    if (input.grantJudge) {
      if (!input.judgeProfileId) {
        throw new AccountManagementError("judge_profile_required");
      }
      judgeProfile = tx.select({ id: judges.id }).from(judges)
        .where(eq(judges.id, input.judgeProfileId)).limit(1).all()[0];
      if (!judgeProfile) {
        throw new AccountManagementError("judge_profile_required");
      }
      if (tx.select({ id: judgeAuthorizations.id })
        .from(judgeAuthorizations)
        .where(and(
          eq(judgeAuthorizations.judgeId, judgeProfile.id),
          eq(judgeAuthorizations.eventId, input.eventId),
          eq(judgeAuthorizations.status, "active"),
        )).limit(1).all()[0]) {
        throw new AccountManagementError("judge_profile_unavailable");
      }
    }

    tx.insert(users).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    }).run();
    tx.insert(accounts).values({
      id: nanoid(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    }).run();
    tx.insert(userAccountControls).values({
      userId,
      status: "active",
      passwordChangeRequired: true,
      temporaryPasswordIssuedAt: now,
      createdAt: now,
      updatedAt: now,
    }).run();
    if (input.grantAdmin) {
      tx.insert(adminAuthorizations).values({
        id: nanoid(),
        userId,
        status: "active",
        grantSource: "people_and_access",
        createdAt: now,
        updatedAt: now,
      }).run();
      audit(tx, {
        action: "administrator_access_granted",
        actorUserId: input.actorUserId,
        targetUserId: userId,
      });
    }
    let judgeAuthorizationId: string | null = null;
    if (input.grantJudge && judgeProfile) {
      judgeAuthorizationId = nanoid();
      tx.insert(judgeAuthorizations).values({
        id: judgeAuthorizationId,
        userId,
        judgeId: judgeProfile.id,
        eventId: input.eventId,
        status: "active",
        grantProvenance: "people_and_access",
        grantedByUserId: input.actorUserId,
        acceptedAt: now,
        createdAt: now,
        updatedAt: now,
      }).run();
      audit(tx, {
        action: "judge_access_granted",
        actorUserId: input.actorUserId,
        targetUserId: userId,
        eventId: input.eventId,
      });
    }
    audit(tx, {
      action: "account_created",
      actorUserId: input.actorUserId,
      targetUserId: userId,
    });
    return { userId, judgeAuthorizationId };
  });
  return { ...result, temporaryPassword };
}

export function updateAccountName(input: {
  actorUserId: string;
  targetUserId: string;
  name: string;
}) {
  const name = normalizeName(input.name);
  db.transaction((tx: typeof db) => {
    requireUser(tx, input.targetUserId);
    const changed = tx.update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, input.targetUserId))
      .returning({ id: users.id })
      .all();
    if (changed.length !== 1) throw new AccountManagementError("user_not_found");
    audit(tx, {
      action: "account_profile_updated",
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
    });
  });
}

export function setAccountEnabled(input: {
  actorUserId: string;
  targetUserId: string;
  enabled: boolean;
  confirmSelf: boolean;
}) {
  requireSelfConfirmation(
    input.actorUserId,
    input.targetUserId,
    input.confirmSelf,
  );
  db.transaction((tx: typeof db) => {
    requireUser(tx, input.targetUserId);
    const now = new Date();
    if (!input.enabled) {
      const targetIsAdministrator = Boolean(tx.select({ id: adminAuthorizations.id })
        .from(adminAuthorizations)
        .where(and(
          eq(adminAuthorizations.userId, input.targetUserId),
          eq(adminAuthorizations.status, "active"),
          isNull(adminAuthorizations.revokedAt),
        ))
        .limit(1)
        .all()[0]);
      if (targetIsAdministrator && activeAdministratorCount(tx) <= 1) {
        throw new AccountManagementError("last_administrator");
      }
    }
    ensureControl(tx, input.targetUserId, now);
    tx.update(userAccountControls).set({
      status: input.enabled ? "active" : "disabled",
      disabledAt: input.enabled ? null : now,
      disabledByUserId: input.enabled ? null : input.actorUserId,
      updatedAt: now,
    }).where(eq(userAccountControls.userId, input.targetUserId)).run();
    if (!input.enabled) {
      tx.delete(sessions).where(eq(sessions.userId, input.targetUserId)).run();
    }
    audit(tx, {
      action: input.enabled ? "account_enabled" : "account_disabled",
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
    });
  });
}

export function setAdministratorAccess(input: {
  actorUserId: string;
  targetUserId: string;
  granted: boolean;
  confirmSelf: boolean;
}) {
  if (!input.granted) {
    requireSelfConfirmation(
      input.actorUserId,
      input.targetUserId,
      input.confirmSelf,
    );
  }
  db.transaction((tx: typeof db) => {
    requireUser(tx, input.targetUserId);
    const now = new Date();
    const existing = tx.select().from(adminAuthorizations)
      .where(eq(adminAuthorizations.userId, input.targetUserId))
      .limit(1).all()[0];
    if (input.granted) {
      if (existing?.status === "active" && !existing.revokedAt) return;
      if (existing) {
        tx.update(adminAuthorizations).set({
          status: "active",
          grantSource: "people_and_access",
          revokedAt: null,
          updatedAt: now,
        }).where(eq(adminAuthorizations.id, existing.id)).run();
      } else {
        tx.insert(adminAuthorizations).values({
          id: nanoid(),
          userId: input.targetUserId,
          status: "active",
          grantSource: "people_and_access",
          createdAt: now,
          updatedAt: now,
        }).run();
      }
      audit(tx, {
        action: "administrator_access_granted",
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
      });
      return;
    }
    if (!existing || existing.status !== "active" || existing.revokedAt) return;
    if (activeAdministratorCount(tx) <= 1) {
      throw new AccountManagementError("last_administrator");
    }
    tx.update(adminAuthorizations).set({
      status: "revoked",
      revokedAt: now,
      updatedAt: now,
    }).where(and(
      eq(adminAuthorizations.id, existing.id),
      eq(adminAuthorizations.status, "active"),
      isNull(adminAuthorizations.revokedAt),
    )).run();
    audit(tx, {
      action: "administrator_access_revoked",
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
    });
  });
}

export function setJudgeAccess(input: {
  actorUserId: string;
  targetUserId: string;
  eventId: string;
  granted: boolean;
  judgeProfileId?: string | null;
}) {
  db.transaction((tx: typeof db) => {
    requireUser(tx, input.targetUserId);
    const now = new Date();
    const existing = tx.select().from(judgeAuthorizations).where(and(
      eq(judgeAuthorizations.userId, input.targetUserId),
      eq(judgeAuthorizations.eventId, input.eventId),
      eq(judgeAuthorizations.status, "active"),
    )).limit(2).all();
    if (existing.length > 1) {
      throw new AccountManagementError("authorization_conflict");
    }
    if (!input.granted) {
      if (!existing[0]) return;
      tx.update(judgeAuthorizations).set({
        status: "revoked",
        revokedAt: now,
        revocationReason: "people_and_access",
        updatedAt: now,
      }).where(eq(judgeAuthorizations.id, existing[0].id)).run();
      audit(tx, {
        action: "judge_access_revoked",
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        eventId: input.eventId,
      });
      return;
    }
    if (existing[0]) {
      if (
        input.judgeProfileId
        && existing[0].judgeId !== input.judgeProfileId
      ) {
        throw new AccountManagementError("authorization_conflict");
      }
      return;
    }
    if (!input.judgeProfileId) {
      throw new AccountManagementError("judge_profile_required");
    }
    if (!tx.select({ id: judges.id }).from(judges)
      .where(eq(judges.id, input.judgeProfileId)).limit(1).all()[0]) {
      throw new AccountManagementError("judge_profile_required");
    }
    if (tx.select({ id: judgeAuthorizations.id })
      .from(judgeAuthorizations)
      .where(and(
        eq(judgeAuthorizations.eventId, input.eventId),
        eq(judgeAuthorizations.judgeId, input.judgeProfileId),
        eq(judgeAuthorizations.status, "active"),
      )).limit(1).all()[0]) {
      throw new AccountManagementError("judge_profile_unavailable");
    }
    const id = nanoid();
    tx.insert(judgeAuthorizations).values({
      id,
      userId: input.targetUserId,
      judgeId: input.judgeProfileId,
      eventId: input.eventId,
      status: "active",
      grantProvenance: "people_and_access",
      grantedByUserId: input.actorUserId,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    }).run();
    audit(tx, {
      action: "judge_access_granted",
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      eventId: input.eventId,
    });
  });
}

export async function resetManagedPassword(input: {
  actorUserId: string;
  targetUserId: string;
  confirmSelf: boolean;
}) {
  requireSelfConfirmation(
    input.actorUserId,
    input.targetUserId,
    input.confirmSelf,
  );
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  db.transaction((tx: typeof db) => {
    requireUser(tx, input.targetUserId);
    const now = new Date();
    const credentials = tx.select().from(accounts).where(and(
      eq(accounts.userId, input.targetUserId),
      eq(accounts.providerId, "credential"),
    )).limit(2).all();
    if (credentials.length > 1) {
      throw new AccountManagementError("credential_state_conflict");
    }
    if (credentials[0]) {
      tx.update(accounts).set({
        password: passwordHash,
        updatedAt: now,
      }).where(eq(accounts.id, credentials[0].id)).run();
    } else {
      tx.insert(accounts).values({
        id: nanoid(),
        accountId: input.targetUserId,
        providerId: "credential",
        userId: input.targetUserId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
    ensureControl(tx, input.targetUserId, now);
    tx.update(userAccountControls).set({
      passwordChangeRequired: true,
      temporaryPasswordIssuedAt: now,
      updatedAt: now,
    }).where(eq(userAccountControls.userId, input.targetUserId)).run();
    audit(tx, {
      action: "account_password_reset",
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
    });
  });
  return { temporaryPassword };
}

export function revokeManagedSessions(input: {
  actorUserId: string;
  targetUserId: string;
}) {
  return db.transaction((tx: typeof db) => {
    requireUser(tx, input.targetUserId);
    const deleted = tx.delete(sessions)
      .where(eq(sessions.userId, input.targetUserId))
      .returning({ id: sessions.id })
      .all();
    audit(tx, {
      action: "account_sessions_revoked",
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
    });
    return { revoked: deleted.length };
  });
}

export function completePasswordChange(userId: string) {
  const now = new Date();
  db.transaction((tx: typeof db) => {
    requireUser(tx, userId);
    ensureControl(tx, userId, now);
    tx.update(userAccountControls).set({
      passwordChangeRequired: false,
      passwordChangedAt: now,
      updatedAt: now,
    }).where(eq(userAccountControls.userId, userId)).run();
    audit(tx, {
      action: "account_password_changed",
      actorUserId: userId,
      targetUserId: userId,
    });
  });
}

export function updateOwnName(userId: string, name: string) {
  updateAccountName({
    actorUserId: userId,
    targetUserId: userId,
    name,
  });
}

export function revokeOwnSession(input: {
  userId: string;
  sessionId: string;
}) {
  return db.transaction((tx: typeof db) => {
    const deleted = tx.delete(sessions).where(and(
      eq(sessions.id, input.sessionId),
      eq(sessions.userId, input.userId),
    )).returning({ id: sessions.id }).all();
    if (deleted.length !== 1) {
      throw new AccountManagementError("session_not_found");
    }
    return { revoked: true };
  });
}

export function getOwnSessionToken(input: {
  userId: string;
  sessionId: string;
}) {
  return db.select({ token: sessions.token }).from(sessions).where(and(
    eq(sessions.id, input.sessionId),
    eq(sessions.userId, input.userId),
  )).limit(1).all()[0]?.token ?? null;
}

export function revokeOtherOwnSessions(input: {
  userId: string;
  currentSessionId: string;
}) {
  return db.delete(sessions).where(and(
    eq(sessions.userId, input.userId),
    ne(sessions.id, input.currentSessionId),
  )).returning({ id: sessions.id }).all().length;
}
