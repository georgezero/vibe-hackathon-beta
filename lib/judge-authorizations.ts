import { and, eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  auditEvents,
  events,
  judgeAuthorizations,
  judges,
  users,
} from "@/lib/db/schema";

export interface ActiveJudgeAuthorization {
  id: string;
  status: "active";
  userId: string;
  judge: {
    id: string;
    name: string;
    email: string;
  };
  eventId: string;
  grantProvenance: string;
  acceptedAt: Date;
}

export type JudgeAuthorizationResolution =
  | { status: "none" }
  | { status: "revoked" }
  | { status: "active"; authorization: ActiveJudgeAuthorization }
  | { status: "conflict" };

export async function resolveActiveJudgeAuthorization(
  userId: string,
  eventId: string,
): Promise<JudgeAuthorizationResolution> {
  const rows = await db.select({
    authorizationId: judgeAuthorizations.id,
    userId: judgeAuthorizations.userId,
    judgeId: judgeAuthorizations.judgeId,
    eventId: judgeAuthorizations.eventId,
    grantProvenance: judgeAuthorizations.grantProvenance,
    acceptedAt: judgeAuthorizations.acceptedAt,
  }).from(judgeAuthorizations)
    .where(and(
      eq(judgeAuthorizations.userId, userId),
      eq(judgeAuthorizations.eventId, eventId),
      eq(judgeAuthorizations.status, "active"),
    ))
    .limit(2);

  if (rows.length === 0) {
    const revoked = await db.select({ id: judgeAuthorizations.id })
      .from(judgeAuthorizations)
      .where(and(
        eq(judgeAuthorizations.userId, userId),
        eq(judgeAuthorizations.eventId, eventId),
        eq(judgeAuthorizations.status, "revoked"),
      ))
      .limit(1);
    return revoked.length ? { status: "revoked" } : { status: "none" };
  }
  if (rows.length !== 1 || !rows[0].acceptedAt) return { status: "conflict" };
  const judgeRows = await db.select({
    id: judges.id,
    name: judges.name,
    email: judges.email,
  }).from(judges).where(eq(judges.id, rows[0].judgeId)).limit(2);
  if (judgeRows.length !== 1) return { status: "conflict" };
  return {
    status: "active",
    authorization: {
      id: rows[0].authorizationId,
      status: "active",
      userId: rows[0].userId,
      judge: {
        id: judgeRows[0].id,
        name: judgeRows[0].name,
        email: judgeRows[0].email,
      },
      eventId: rows[0].eventId,
      grantProvenance: rows[0].grantProvenance,
      acceptedAt: rows[0].acceptedAt,
    },
  };
}

export async function inspectJudgeAuthorizationState() {
  const [userRows, judgeRows, eventRows, authorizationRows] = await Promise.all([
    db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    }).from(users),
    db.select({
      id: judges.id,
      name: judges.name,
      email: judges.email,
    }).from(judges),
    db.select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      isActive: events.isActive,
    }).from(events),
    db.select({
      id: judgeAuthorizations.id,
      userId: judgeAuthorizations.userId,
      judgeId: judgeAuthorizations.judgeId,
      eventId: judgeAuthorizations.eventId,
      status: judgeAuthorizations.status,
      grantProvenance: judgeAuthorizations.grantProvenance,
      invitedAt: judgeAuthorizations.invitedAt,
      acceptedAt: judgeAuthorizations.acceptedAt,
      revokedAt: judgeAuthorizations.revokedAt,
      revocationReason: judgeAuthorizations.revocationReason,
      createdAt: judgeAuthorizations.createdAt,
      updatedAt: judgeAuthorizations.updatedAt,
    }).from(judgeAuthorizations),
  ]);
  return {
    users: userRows,
    judges: judgeRows,
    events: eventRows,
    authorizations: authorizationRows,
  };
}

type GrantInput = {
  userId: string;
  judgeId: string;
  eventId: string;
  grantProvenance: string;
  grantedByUserId?: string | null;
};

type GrantPreview =
  | { status: "ready"; input: GrantInput }
  | { status: "idempotent"; authorizationId: string; input: GrantInput }
  | {
    status: "rejected";
    reason:
      | "missing_user"
      | "missing_judge"
      | "missing_event"
      | "missing_granting_user"
      | "conflict";
  };

function audit(
  tx: typeof db,
  action:
    | "judge_authorization_granted"
    | "judge_authorization_revoked"
    | "judge_authorization_conflict"
    | "judge_authorization_inspected",
  input: {
    authorizationId?: string | null;
    userId?: string | null;
    judgeId?: string | null;
    eventId?: string | null;
    status?: string | null;
    provenance?: string | null;
    reason?: string | null;
  },
) {
  tx.insert(auditEvents).values({
    id: nanoid(),
    entityType: "judge_authorization",
    entityId: input.authorizationId ?? `${input.judgeId ?? "unknown"}:${input.eventId ?? "unknown"}`,
    action,
    actorType: "operator",
    actorId: null,
    metadata: input,
    createdAt: new Date(),
  }).run();
}

function previewInTransaction(tx: typeof db, input: GrantInput): GrantPreview {
  if (!input.userId.trim()) return { status: "rejected", reason: "missing_user" };
  if (!input.judgeId.trim()) return { status: "rejected", reason: "missing_judge" };
  if (!input.eventId.trim()) return { status: "rejected", reason: "missing_event" };
  if (!input.grantProvenance.trim()) return { status: "rejected", reason: "conflict" };

  if (!tx.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1).all()[0]) {
    return { status: "rejected", reason: "missing_user" };
  }
  if (!tx.select({ id: judges.id }).from(judges).where(eq(judges.id, input.judgeId)).limit(1).all()[0]) {
    return { status: "rejected", reason: "missing_judge" };
  }
  if (!tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId)).limit(1).all()[0]) {
    return { status: "rejected", reason: "missing_event" };
  }
  if (
    input.grantedByUserId
    && !tx.select({ id: users.id }).from(users)
      .where(eq(users.id, input.grantedByUserId)).limit(1).all()[0]
  ) {
    return { status: "rejected", reason: "missing_granting_user" };
  }

  const active = tx.select().from(judgeAuthorizations).where(and(
    eq(judgeAuthorizations.eventId, input.eventId),
    eq(judgeAuthorizations.status, "active"),
    or(
      eq(judgeAuthorizations.userId, input.userId),
      eq(judgeAuthorizations.judgeId, input.judgeId),
    ),
  )).all();
  if (
    active.length === 1
    && active[0].userId === input.userId
    && active[0].judgeId === input.judgeId
  ) {
    return { status: "idempotent", authorizationId: active[0].id, input };
  }
  if (active.length > 0) return { status: "rejected", reason: "conflict" };
  return { status: "ready", input };
}

export function previewJudgeAuthorizationGrant(input: GrantInput): GrantPreview {
  return db.transaction((tx: typeof db) => previewInTransaction(tx, input));
}

export type GrantJudgeAuthorizationResult =
  | { status: "granted"; authorizationId: string }
  | { status: "idempotent"; authorizationId: string }
  | Extract<GrantPreview, { status: "rejected" }>;

export function grantJudgeAuthorization(
  input: GrantInput,
): GrantJudgeAuthorizationResult {
  return db.transaction((tx: typeof db) => {
    const preview = previewInTransaction(tx, input);
    if (preview.status === "rejected") {
      audit(tx, "judge_authorization_conflict", {
        userId: input.userId,
        judgeId: input.judgeId,
        eventId: input.eventId,
        provenance: input.grantProvenance,
        reason: preview.reason,
      });
      return preview;
    }
    if (preview.status === "idempotent") {
      return {
        status: "idempotent" as const,
        authorizationId: preview.authorizationId,
      };
    }

    const now = new Date();
    const authorizationId = nanoid();
    tx.insert(judgeAuthorizations).values({
      id: authorizationId,
      userId: input.userId,
      judgeId: input.judgeId,
      eventId: input.eventId,
      status: "active",
      grantProvenance: input.grantProvenance.trim(),
      grantedByUserId: input.grantedByUserId ?? null,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    }).run();
    audit(tx, "judge_authorization_granted", {
      authorizationId,
      userId: input.userId,
      judgeId: input.judgeId,
      eventId: input.eventId,
      status: "active",
      provenance: input.grantProvenance,
    });
    return { status: "granted" as const, authorizationId };
  });
}

export type RevokeJudgeAuthorizationResult =
  | { status: "revoked"; authorizationId: string }
  | { status: "idempotent"; authorizationId: string }
  | { status: "not_found" };

export function revokeJudgeAuthorization(input: {
  authorizationId: string;
  reason: string;
}): RevokeJudgeAuthorizationResult {
  return db.transaction((tx: typeof db) => {
    const authorization = tx.select().from(judgeAuthorizations)
      .where(eq(judgeAuthorizations.id, input.authorizationId)).limit(1).all()[0];
    if (!authorization) return { status: "not_found" as const };
    if (authorization.status === "revoked") {
      return { status: "idempotent" as const, authorizationId: authorization.id };
    }
    const now = new Date();
    const changed = tx.update(judgeAuthorizations).set({
      status: "revoked",
      revokedAt: now,
      revocationReason: input.reason.trim() || "operator_revocation",
      updatedAt: now,
    }).where(and(
      eq(judgeAuthorizations.id, authorization.id),
      eq(judgeAuthorizations.status, authorization.status),
    )).returning({ id: judgeAuthorizations.id }).all();
    if (changed.length !== 1) return { status: "not_found" as const };
    audit(tx, "judge_authorization_revoked", {
      authorizationId: authorization.id,
      userId: authorization.userId,
      judgeId: authorization.judgeId,
      eventId: authorization.eventId,
      status: "revoked",
      reason: input.reason,
    });
    return { status: "revoked" as const, authorizationId: authorization.id };
  });
}

export function recordJudgeAuthorizationInspection(eventId?: string) {
  db.transaction((tx: typeof db) => {
    audit(tx, "judge_authorization_inspected", {
      eventId: eventId ?? null,
      status: "inspected",
    });
  });
}
