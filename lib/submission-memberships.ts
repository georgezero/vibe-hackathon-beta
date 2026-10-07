import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  auditEvents,
  chatEvents,
  chatRooms,
  submissionMembershipInvitations,
  submissionMemberships,
  submissionOwners,
  submissions,
  teamMembers,
  users,
} from "@/lib/db/schema";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SubmissionMembershipRole = "owner" | "teammate";
export type SubmissionMembershipStatus = "invited" | "active" | "revoked";

export type SubmissionMembershipResolution =
  | { status: "none" }
  | { status: "active"; membership: typeof submissionMemberships.$inferSelect }
  | { status: "conflict" };

export class SubmissionMembershipError extends Error {
  constructor(
    public readonly code:
      | "submission_not_found"
      | "user_not_found"
      | "owner_not_found"
      | "owner_mismatch"
      | "membership_conflict"
      | "invitation_not_found"
      | "invitation_expired"
      | "invitation_revoked"
      | "invitation_already_used"
      | "account_changed"
      | "owner_cannot_revoke"
      | "membership_not_found"
      | "not_owner",
  ) {
    super(code);
    this.name = "SubmissionMembershipError";
  }
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function invitationToken() {
  return `join_${randomBytes(32).toString("base64url")}`;
}

function activeMembershipPredicate(submissionId: string, userId: string) {
  return and(
    eq(submissionMemberships.submissionId, submissionId),
    eq(submissionMemberships.userId, userId),
    eq(submissionMemberships.status, "active"),
  );
}

export async function resolveSubmissionMembership(input: {
  submissionId: string;
  userId: string;
}): Promise<SubmissionMembershipResolution> {
  const rows = await db.select().from(submissionMemberships)
    .where(activeMembershipPredicate(input.submissionId, input.userId))
    .limit(2);
  if (rows.length === 0) return { status: "none" };
  if (rows.length !== 1) return { status: "conflict" };
  return { status: "active", membership: rows[0] };
}

export async function resolveSubmissionOwnerMembership(input: {
  submissionId: string;
  userId: string;
}) {
  const resolution = await resolveSubmissionMembership(input);
  if (resolution.status !== "active") return resolution;
  if (resolution.membership.role !== "owner") return { status: "none" as const };
  return resolution;
}

export async function listSubmissionMemberships(submissionId: string) {
  return db.select({
    membership: submissionMemberships,
    user: {
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
    },
  }).from(submissionMemberships)
    .innerJoin(users, eq(users.id, submissionMemberships.userId))
    .where(eq(submissionMemberships.submissionId, submissionId))
    .orderBy(desc(submissionMemberships.createdAt));
}

export async function listSubmissionMembershipInvitations(submissionId: string) {
  const rows = await db.select({
    id: submissionMembershipInvitations.id,
    status: submissionMembershipInvitations.status,
    expiresAt: submissionMembershipInvitations.expiresAt,
    intendedMemberId: submissionMembershipInvitations.intendedMemberId,
    createdAt: submissionMembershipInvitations.createdAt,
  }).from(submissionMembershipInvitations)
    .where(eq(submissionMembershipInvitations.submissionId, submissionId))
    .orderBy(desc(submissionMembershipInvitations.createdAt));
  return rows.map((row: typeof rows[number]) => {
    if (row.status === "pending" && row.expiresAt.getTime() <= Date.now()) {
      void db.update(submissionMembershipInvitations).set({ status: "expired", revokedAt: new Date(), updatedAt: new Date() }).where(eq(submissionMembershipInvitations.id, row.id));
      return { ...row, status: "expired" as const };
    }
    return row;
  });
}

export async function ensureOwnerMembership(input: {
  submissionId: string;
  userId: string;
}) {
  const [submission, owner, user] = await Promise.all([
    db.select({ id: submissions.id }).from(submissions).where(eq(submissions.id, input.submissionId)).limit(1),
    db.select({ id: submissionOwners.id, userId: submissionOwners.userId })
      .from(submissionOwners).where(eq(submissionOwners.submissionId, input.submissionId)).limit(2),
    db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1),
  ]);
  if (!submission[0]) throw new SubmissionMembershipError("submission_not_found");
  if (!user[0]) throw new SubmissionMembershipError("user_not_found");
  if (owner.length === 0) throw new SubmissionMembershipError("owner_not_found");
  if (owner.length !== 1) throw new SubmissionMembershipError("membership_conflict");
  if (owner[0].userId !== input.userId) throw new SubmissionMembershipError("owner_mismatch");

  const now = new Date();
  const existing = await db.select().from(submissionMemberships)
    .where(and(
      eq(submissionMemberships.submissionId, input.submissionId),
      eq(submissionMemberships.userId, input.userId),
      eq(submissionMemberships.role, "owner"),
      eq(submissionMemberships.status, "active"),
    )).limit(2);
  if (existing.length > 1) throw new SubmissionMembershipError("membership_conflict");
  if (existing[0]) return existing[0];

  const activeOwner = await db.select({ id: submissionMemberships.id })
    .from(submissionMemberships).where(and(
      eq(submissionMemberships.submissionId, input.submissionId),
      eq(submissionMemberships.role, "owner"),
      eq(submissionMemberships.status, "active"),
    )).limit(2);
  if (activeOwner.length > 0) throw new SubmissionMembershipError("membership_conflict");

  const id = `membership_${nanoid(16)}`;
  await db.insert(submissionMemberships).values({
    id,
    submissionId: input.submissionId,
    userId: input.userId,
    role: "owner",
    status: "active",
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(auditEvents).values({
    id: nanoid(),
    entityType: "submission_membership",
    entityId: id,
    action: "submission_membership_joined",
    actorType: "user",
    actorId: input.userId,
    metadata: { submissionId: input.submissionId, role: "owner" } as unknown as Record<string, unknown>,
    createdAt: now,
  });
  return (await db.select().from(submissionMemberships).where(eq(submissionMemberships.id, id)).limit(1))[0];
}

export async function createTeammateInvitation(input: {
  submissionId: string;
  ownerUserId: string;
  intendedMemberId?: string | null;
}) {
  const owner = await resolveSubmissionOwnerMembership({ submissionId: input.submissionId, userId: input.ownerUserId });
  if (owner.status !== "active") throw new SubmissionMembershipError("not_owner");
  if (input.intendedMemberId) {
    const member = await db.select({ id: teamMembers.id })
      .from(teamMembers).where(and(
        eq(teamMembers.id, input.intendedMemberId),
        eq(teamMembers.submissionId, input.submissionId),
      )).limit(1);
    if (!member[0]) throw new SubmissionMembershipError("invitation_not_found");
  }
  const rawToken = invitationToken();
  const now = new Date();
  const id = `membership_invite_${nanoid(16)}`;
  await db.insert(submissionMembershipInvitations).values({
    id,
    submissionId: input.submissionId,
    invitedByUserId: input.ownerUserId,
    intendedMemberId: input.intendedMemberId ?? null,
    tokenHash: digest(rawToken),
    role: "teammate",
    status: "pending",
    expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(auditEvents).values({
    id: nanoid(),
    entityType: "submission_membership_invitation",
    entityId: id,
    action: "submission_membership_invited",
    actorType: "user",
    actorId: input.ownerUserId,
    metadata: { submissionId: input.submissionId, intendedMemberId: input.intendedMemberId ?? null } as unknown as Record<string, unknown>,
    createdAt: now,
  });
  return { id, token: rawToken, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS) };
}

export async function inspectTeammateInvitation(token: string) {
  const hash = digest(token.trim());
  const rows = await db.select({
    invitation: submissionMembershipInvitations,
    submission: {
      id: submissions.id,
      teamName: submissions.teamName,
      projectTitle: submissions.projectTitle,
    },
    intendedMember: {
      name: teamMembers.name,
      affiliation: teamMembers.affiliation,
    },
  }).from(submissionMembershipInvitations)
    .innerJoin(submissions, eq(submissions.id, submissionMembershipInvitations.submissionId))
    .leftJoin(teamMembers, eq(teamMembers.id, submissionMembershipInvitations.intendedMemberId))
    .where(eq(submissionMembershipInvitations.tokenHash, hash)).limit(1);
  const row = rows[0];
  if (!row) return { status: "not_found" as const };
  if (row.invitation.status === "pending" && row.invitation.expiresAt.getTime() <= Date.now()) {
    await db.update(submissionMembershipInvitations).set({
      status: "expired", revokedAt: new Date(), updatedAt: new Date(),
    }).where(eq(submissionMembershipInvitations.id, row.invitation.id));
    return { status: "expired" as const };
  }
  if (row.invitation.status === "revoked") return { status: "revoked" as const };
  if (row.invitation.status === "expired") return { status: "expired" as const };
  if (row.invitation.status === "accepted") return { status: "accepted" as const, ...row };
  return { status: "pending" as const, ...row };
}

export async function acceptTeammateInvitation(input: {
  token: string;
  userId: string;
}) {
  const inspected = await inspectTeammateInvitation(input.token);
  if (inspected.status === "not_found") throw new SubmissionMembershipError("invitation_not_found");
  if (inspected.status === "expired") throw new SubmissionMembershipError("invitation_expired");
  if (inspected.status === "revoked") throw new SubmissionMembershipError("invitation_revoked");
  if (inspected.status === "accepted") {
    const existing = await resolveSubmissionMembership({ submissionId: inspected.submission.id, userId: input.userId });
    if (existing.status === "active" && existing.membership.invitationId === inspected.invitation.id) return existing.membership;
    throw new SubmissionMembershipError("invitation_already_used");
  }

  const now = new Date();
  const existing = await resolveSubmissionMembership({ submissionId: inspected.submission.id, userId: input.userId });
  if (existing.status === "conflict") throw new SubmissionMembershipError("membership_conflict");
  if (existing.status === "active") {
    throw new SubmissionMembershipError("membership_conflict");
  }
  const membershipId = `membership_${nanoid(16)}`;
  try {
    db.transaction((tx: typeof db) => {
      tx.insert(submissionMemberships).values({
        id: membershipId,
        submissionId: inspected.submission.id,
        userId: input.userId,
        role: "teammate",
        status: "active",
        invitationId: inspected.invitation.id,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      }).run();
      tx.update(submissionMembershipInvitations).set({
        status: "accepted", acceptedAt: now, updatedAt: now,
      }).where(and(
        eq(submissionMembershipInvitations.id, inspected.invitation.id),
        eq(submissionMembershipInvitations.status, "pending"),
      )).run();
      tx.insert(auditEvents).values({
        id: nanoid(),
        entityType: "submission_membership",
        entityId: membershipId,
        action: "submission_membership_joined",
        actorType: "user",
        actorId: input.userId,
        metadata: { submissionId: inspected.submission.id, role: "teammate", invitationId: inspected.invitation.id } as unknown as Record<string, unknown>,
        createdAt: now,
      }).run();
    });
  } catch {
    // Two tabs can submit the same invitation at nearly the same time. If the
    // first transaction committed, return that membership instead of turning
    // a safe retry into a duplicate-looking conflict.
    const committed = await db.select().from(submissionMemberships).where(and(
      eq(submissionMemberships.submissionId, inspected.submission.id),
      eq(submissionMemberships.userId, input.userId),
      eq(submissionMemberships.invitationId, inspected.invitation.id),
      eq(submissionMemberships.status, "active"),
    )).limit(1);
    if (committed[0]) return committed[0];
    throw new SubmissionMembershipError("membership_conflict");
  }
  return (await db.select().from(submissionMemberships).where(eq(submissionMemberships.id, membershipId)).limit(1))[0];
}

export async function revokeTeammateMembership(input: {
  submissionId: string;
  actorUserId: string;
  membershipId: string;
  reason?: string;
}) {
  const owner = await resolveSubmissionOwnerMembership({ submissionId: input.submissionId, userId: input.actorUserId });
  if (owner.status !== "active") throw new SubmissionMembershipError("not_owner");
  const rows = await db.select().from(submissionMemberships).where(and(
    eq(submissionMemberships.id, input.membershipId),
    eq(submissionMemberships.submissionId, input.submissionId),
  )).limit(1);
  const membership = rows[0];
  if (!membership) throw new SubmissionMembershipError("membership_not_found");
  if (membership.role === "owner") throw new SubmissionMembershipError("owner_cannot_revoke");
  if (membership.status === "revoked") return membership;
  const now = new Date();
  db.transaction((tx: typeof db) => {
    tx.update(submissionMemberships).set({
      status: "revoked", revokedAt: now, revokedByUserId: input.actorUserId,
      revocationReason: input.reason?.trim() || "owner_revoked", updatedAt: now,
    }).where(and(eq(submissionMemberships.id, membership.id), eq(submissionMemberships.status, "active"))).run();
    if (membership.invitationId) {
      tx.update(submissionMembershipInvitations).set({
        status: "revoked", revokedAt: now, updatedAt: now,
      }).where(and(eq(submissionMembershipInvitations.id, membership.invitationId), eq(submissionMembershipInvitations.status, "accepted"))).run();
    }
    tx.insert(auditEvents).values({
      id: nanoid(), entityType: "submission_membership", entityId: membership.id,
      action: "submission_membership_revoked", actorType: "user", actorId: input.actorUserId,
      metadata: { submissionId: input.submissionId, revokedUserId: membership.userId, reason: input.reason?.trim() || "owner_revoked" } as unknown as Record<string, unknown>,
      createdAt: now,
    }).run();
    const room = tx.select({ id: chatRooms.id }).from(chatRooms)
      .where(and(eq(chatRooms.submissionId, input.submissionId), eq(chatRooms.status, "active")))
      .limit(1).all()[0];
    if (room) {
      tx.insert(chatEvents).values({
        id: `event_${nanoid(16)}`,
        roomId: room.id,
        eventType: "membership_revoked",
        actorUserId: input.actorUserId,
        createdAt: now,
      }).run();
    }
  });
  return (await db.select().from(submissionMemberships).where(eq(submissionMemberships.id, membership.id)).limit(1))[0];
}

export async function revokeTeammateInvitation(input: {
  submissionId: string;
  invitationId: string;
  actorUserId: string;
}) {
  const owner = await resolveSubmissionOwnerMembership({ submissionId: input.submissionId, userId: input.actorUserId });
  if (owner.status !== "active") throw new SubmissionMembershipError("not_owner");
  const rows = await db.select().from(submissionMembershipInvitations).where(and(
    eq(submissionMembershipInvitations.id, input.invitationId),
    eq(submissionMembershipInvitations.submissionId, input.submissionId),
  )).limit(1);
  const invitation = rows[0];
  if (!invitation) throw new SubmissionMembershipError("invitation_not_found");
  if (invitation.status === "accepted") throw new SubmissionMembershipError("invitation_already_used");
  if (invitation.status === "revoked" || invitation.status === "expired") return invitation;
  const now = new Date();
  db.transaction((tx: typeof db) => {
    tx.update(submissionMembershipInvitations).set({ status: "revoked", revokedAt: now, updatedAt: now })
      .where(and(eq(submissionMembershipInvitations.id, invitation.id), eq(submissionMembershipInvitations.status, "pending"))).run();
    tx.insert(auditEvents).values({
      id: nanoid(), entityType: "submission_membership_invitation", entityId: invitation.id,
      action: "submission_membership_invitation_revoked", actorType: "user", actorId: input.actorUserId,
      metadata: { submissionId: input.submissionId } as unknown as Record<string, unknown>, createdAt: now,
    }).run();
  });
  return (await db.select().from(submissionMembershipInvitations).where(eq(submissionMembershipInvitations.id, invitation.id)).limit(1))[0];
}
