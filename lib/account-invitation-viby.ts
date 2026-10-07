import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accountInvitations,
  accountInvitationVibyTransactions,
  vibyIdentityLinkTransactions,
} from "@/lib/db/schema";
import { inspectAccountInvitation } from "@/lib/account-invitations";
import { createVibyLoginTransaction } from "@/lib/viby-login-transactions";
import { vibyAppSlug } from "@/lib/viby";

export async function createInvitationVibyTransaction(token: string) {
  const invitation = await inspectAccountInvitation(token);
  if (!invitation || invitation.lifecycle !== "pending") return null;
  const issued = await createVibyLoginTransaction({
    operation: "admin_login",
    returnTo: "/account",
    expectedAudience: vibyAppSlug(),
    freshnessRequired: true,
  });
  await db.insert(accountInvitationVibyTransactions).values({
    loginTransactionId: issued.transaction.id,
    invitationId: invitation.id,
    createdAt: new Date(),
  });
  return { ...issued, invitation };
}

export async function invitationForLoginTransaction(loginTransactionId: string) {
  const rows = await db.select({
    invitationId: accountInvitations.id,
    userId: accountInvitations.userId,
    tokenHash: accountInvitations.tokenHash,
    status: accountInvitations.status,
    expiresAt: accountInvitations.expiresAt,
  }).from(accountInvitationVibyTransactions)
    .innerJoin(accountInvitations, eq(accountInvitations.id, accountInvitationVibyTransactions.invitationId))
    .where(eq(accountInvitationVibyTransactions.loginTransactionId, loginTransactionId))
    .limit(2);
  return rows.length === 1 ? rows[0] : null;
}

export async function bindInvitationLinkTransaction(input: {
  loginTransactionId: string;
  linkTransactionId: string;
}) {
  const rows = await db.update(accountInvitationVibyTransactions).set({
    linkTransactionId: input.linkTransactionId,
  }).where(and(
    eq(accountInvitationVibyTransactions.loginTransactionId, input.loginTransactionId),
    isNull(accountInvitationVibyTransactions.linkTransactionId),
  )).returning().all();
  return rows.length === 1;
}

export async function invitationForLinkTransaction(linkTransactionId: string) {
  const rows = await db.select({
    invitationId: accountInvitations.id,
    userId: accountInvitations.userId,
    tokenHash: accountInvitations.tokenHash,
    status: accountInvitations.status,
    expiresAt: accountInvitations.expiresAt,
    loginTransactionId: accountInvitationVibyTransactions.loginTransactionId,
    linkStatus: vibyIdentityLinkTransactions.status,
  }).from(accountInvitationVibyTransactions)
    .innerJoin(accountInvitations, eq(accountInvitations.id, accountInvitationVibyTransactions.invitationId))
    .innerJoin(vibyIdentityLinkTransactions, eq(vibyIdentityLinkTransactions.id, accountInvitationVibyTransactions.linkTransactionId))
    .where(eq(accountInvitationVibyTransactions.linkTransactionId, linkTransactionId))
    .limit(2);
  return rows.length === 1 ? rows[0] : null;
}
