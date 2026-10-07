import { and, asc, desc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  auditEvents,
  directConversationMembers,
  directConversations,
  directMessageEvents,
  directMessageReadStates,
  directMessageReports,
  directMessages,
  participantBlocks,
  participantMessagingPreferences,
  userAccountControls,
  userProfiles,
  users,
} from "@/lib/db/schema";
import { normalizeProfileHandle } from "@/lib/user-profiles";

export const DIRECT_MESSAGE_MAX_LENGTH = 4000;
export const DIRECT_MESSAGE_CLIENT_ID_MAX_LENGTH = 160;
export const DIRECT_MESSAGE_PAGE_SIZE = 50;

function eventId() { return `dme_${String(Date.now()).padStart(13, "0")}_${nanoid(10)}`; }

export type MessagingPreference = "participants" | "none";
export type DirectReportCategory = "harassment" | "spam" | "other";

export class DirectMessagingError extends Error {
  constructor(public readonly code:
    | "authentication_required"
    | "participant_required"
    | "recipient_not_available"
    | "self_message"
    | "conversation_not_found"
    | "conversation_forbidden"
    | "message_blocked"
    | "recipient_unavailable"
    | "messaging_disabled"
    | "invalid_message"
    | "invalid_client_message_id"
    | "message_conflict"
    | "invalid_cursor"
    | "invalid_report"
    | "invalid_preference"
    | "report_forbidden"
    | "rate_limited") {
    super(code);
    this.name = "DirectMessagingError";
  }
}

export type DirectParticipantIdentity = {
  displayName: string;
  initials: string;
  handle: string | null;
  headline: string | null;
  affiliation: string | null;
  isFormerParticipant: boolean;
};

export type DirectMessageProjection = {
  id: string;
  author: "self" | "participant" | "former_participant";
  authorIdentity: DirectParticipantIdentity;
  body: string;
  createdAt: string;
};

export type DirectConversationSummary = {
  id: string;
  participant: DirectParticipantIdentity;
  latestMessage: string | null;
  latestMessageAt: string | null;
  unreadCount: number;
  canSend: boolean;
  blocked: boolean;
};

export type DirectConversationAccess = {
  id: string;
  participantUserId: string;
  participant: DirectParticipantIdentity;
  currentUserId: string;
  canSend: boolean;
  blocked: boolean;
};

function initials(displayName: string) {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || "?";
}

function normalizeBody(value: unknown) {
  if (typeof value !== "string") throw new DirectMessagingError("invalid_message");
  const body = value.replace(/\r\n?/g, "\n").trim();
  if (!body || body.length > DIRECT_MESSAGE_MAX_LENGTH) throw new DirectMessagingError("invalid_message");
  return body;
}

function normalizeClientMessageId(value: unknown) {
  if (typeof value !== "string") throw new DirectMessagingError("invalid_client_message_id");
  const id = value.trim();
  if (!id || id.length > DIRECT_MESSAGE_CLIENT_ID_MAX_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(id)) {
    throw new DirectMessagingError("invalid_client_message_id");
  }
  return id;
}

function isUniqueConstraint(error: unknown) {
  return String(error).toUpperCase().includes("UNIQUE CONSTRAINT FAILED")
    || (error as { code?: string } | null)?.code === "SQLITE_CONSTRAINT_UNIQUE";
}

async function activeAccount(userId: string) {
  const rows = await db.select({ userId: users.id, status: userAccountControls.status })
    .from(users).leftJoin(userAccountControls, eq(userAccountControls.userId, users.id)).where(eq(users.id, userId)).limit(1);
  return Boolean(rows[0]) && (!rows[0].status || rows[0].status === "active");
}

async function blockedEitherWay(a: string, b: string) {
  const rows = await db.select({ blockerUserId: participantBlocks.blockerUserId })
    .from(participantBlocks)
    .where(or(
      and(eq(participantBlocks.blockerUserId, a), eq(participantBlocks.blockedUserId, b)),
      and(eq(participantBlocks.blockerUserId, b), eq(participantBlocks.blockedUserId, a)),
    )).limit(1);
  return Boolean(rows[0]);
}

function identityFromRow(row: {
  accountName: string | null;
  profileName: string | null;
  profileHandle: string | null;
  profileHeadline: string | null;
  profileAffiliation: string | null;
  profileVisibility: string | null;
  profileDeactivatedAt: Date | null;
  accountStatus: string | null;
}): DirectParticipantIdentity {
  const former = row.accountStatus === "disabled" || row.profileDeactivatedAt !== null;
  const publicProfile = !former && row.profileVisibility === "public" && Boolean(row.profileName && row.profileHandle);
  const displayName = former ? "Former participant" : (publicProfile ? row.profileName : row.accountName)?.trim() || "Participant";
  return {
    displayName,
    initials: initials(displayName),
    handle: publicProfile ? row.profileHandle : null,
    headline: publicProfile ? row.profileHeadline : null,
    affiliation: publicProfile ? row.profileAffiliation : null,
    isFormerParticipant: former,
  };
}

async function identityForUserIds(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map<string, DirectParticipantIdentity>();
  const rows = await db.select({
    userId: users.id,
    accountName: users.name,
    profileName: userProfiles.displayName,
    profileHandle: userProfiles.handle,
    profileHeadline: userProfiles.headline,
    profileAffiliation: userProfiles.affiliation,
    profileVisibility: userProfiles.visibility,
    profileDeactivatedAt: userProfiles.deactivatedAt,
    accountStatus: userAccountControls.status,
  }).from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(userAccountControls, eq(userAccountControls.userId, users.id))
    .where(inArray(users.id, ids));
  const result = new Map<string, DirectParticipantIdentity>();
  for (const row of rows) result.set(row.userId, identityFromRow(row));
  return result;
}

async function conversationForUser(conversationId: string, userId: string) {
  const rows = await db.select({ conversation: directConversations, member: directConversationMembers })
    .from(directConversations)
    .innerJoin(directConversationMembers, and(
      eq(directConversationMembers.conversationId, directConversations.id),
      eq(directConversationMembers.userId, userId),
    ))
    .where(eq(directConversations.id, conversationId)).limit(1);
  return rows[0]?.conversation ?? null;
}

export async function getMessagingPreference(userId: string): Promise<MessagingPreference> {
  // Kept as a compatibility read for older clients. H.4R.1 deliberately
  // removes this setting as a messaging-authority gate; stored legacy values
  // are ignored and the effective policy is always universal People messaging.
  void userId;
  return "participants";
}

export async function updateMessagingPreference(userId: string, value: unknown) {
  if (value !== "participants" && value !== "none") throw new DirectMessagingError("invalid_preference");
  const now = new Date();
  await db.insert(participantMessagingPreferences).values({ userId, allowIncoming: value, updatedAt: now })
    .onConflictDoUpdate({ target: participantMessagingPreferences.userId, set: { allowIncoming: value, updatedAt: now } });
  await db.insert(auditEvents).values({
    id: nanoid(), entityType: "participant_messaging_preference", entityId: userId,
    action: "participant_messaging_preference_updated", actorType: "user", actorId: userId,
    metadata: { allowIncoming: value }, createdAt: now,
  });
  // Preserve the legacy row for compatibility/audit history, but never let it
  // change who may initiate or receive a direct conversation.
  return "participants" as MessagingPreference;
}

async function eligibleRecipient(handleInput: unknown) {
  let handle: string;
  try { handle = normalizeProfileHandle(handleInput); } catch { throw new DirectMessagingError("recipient_not_available"); }
  const rows = await db.select({
    userId: userProfiles.userId,
    profileHandle: userProfiles.handle,
    profileVisibility: userProfiles.visibility,
    discoverable: userProfiles.discoverable,
    deactivatedAt: userProfiles.deactivatedAt,
    accountStatus: userAccountControls.status,
  }).from(userProfiles)
    .leftJoin(userAccountControls, eq(userAccountControls.userId, userProfiles.userId))
    .where(and(eq(userProfiles.handle, handle), eq(userProfiles.visibility, "public"), eq(userProfiles.discoverable, true), isNull(userProfiles.deactivatedAt)))
    .limit(1);
  const row = rows[0];
  if (!row || (row.accountStatus && row.accountStatus !== "active")) {
    throw new DirectMessagingError("recipient_not_available");
  }
  return row.userId;
}

/** Whether a profile may display the initiation affordance for this viewer. */
export async function canInitiateDirectMessage(input: { senderUserId: string; recipientHandle: unknown }) {
  try {
    if (!(await activeAccount(input.senderUserId))) return false;
    const recipientUserId = await eligibleRecipient(input.recipientHandle);
    return recipientUserId !== input.senderUserId && !(await blockedEitherWay(input.senderUserId, recipientUserId));
  } catch {
    return false;
  }
}

export async function findOrCreateDirectConversation(input: { senderUserId: string; recipientHandle: unknown }) {
  if (!(await activeAccount(input.senderUserId))) {
    throw new DirectMessagingError("participant_required");
  }
  const recipientUserId = await eligibleRecipient(input.recipientHandle);
  if (recipientUserId === input.senderUserId) throw new DirectMessagingError("self_message");
  if (await blockedEitherWay(input.senderUserId, recipientUserId)) throw new DirectMessagingError("message_blocked");
  const [a, b] = [input.senderUserId, recipientUserId].sort();
  const existing = await db.select().from(directConversations).where(and(
    eq(directConversations.participantAUserId, a), eq(directConversations.participantBUserId, b),
  )).limit(1);
  if (existing[0]) return existing[0].id;
  const conversationId = `dm_${nanoid(20)}`;
  const now = new Date();
  try {
    db.transaction((tx: typeof db) => {
      tx.insert(directConversations).values({ id: conversationId, participantAUserId: a, participantBUserId: b, createdAt: now, updatedAt: now }).run();
      tx.insert(directConversationMembers).values([
        { id: `dmm_${nanoid(16)}`, conversationId, userId: a, createdAt: now },
        { id: `dmm_${nanoid(16)}`, conversationId, userId: b, createdAt: now },
      ]).run();
      tx.insert(auditEvents).values({ id: nanoid(), entityType: "direct_conversation", entityId: conversationId, action: "direct_conversation_created", actorType: "user", actorId: input.senderUserId, metadata: {}, createdAt: now }).run();
    });
    return conversationId;
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const raced = await db.select({ id: directConversations.id }).from(directConversations).where(and(eq(directConversations.participantAUserId, a), eq(directConversations.participantBUserId, b))).limit(1);
    if (raced[0]) return raced[0].id;
    throw new DirectMessagingError("conversation_not_found");
  }
}

export async function resolveDirectConversationAccess(input: { conversationId: string; userId: string }): Promise<DirectConversationAccess> {
  const conversation = await conversationForUser(input.conversationId, input.userId);
  if (!conversation) throw new DirectMessagingError("conversation_forbidden");
  const participantUserId = conversation.participantAUserId === input.userId ? conversation.participantBUserId : conversation.participantAUserId;
  const identities = await identityForUserIds([participantUserId]);
  const blocked = await blockedEitherWay(input.userId, participantUserId);
  const unavailable = !(await activeAccount(input.userId)) || !(await activeAccount(participantUserId));
  const canSend = !blocked && !unavailable;
  return { id: conversation.id, participantUserId, participant: identities.get(participantUserId) ?? identityFromRow({ accountName: null, profileName: null, profileHandle: null, profileHeadline: null, profileAffiliation: null, profileVisibility: null, profileDeactivatedAt: new Date(), accountStatus: "disabled" }), currentUserId: input.userId, canSend, blocked };
}

export async function listDirectConversations(userId: string): Promise<DirectConversationSummary[]> {
  const memberships = await db.select({ conversation: directConversations })
    .from(directConversationMembers).innerJoin(directConversations, eq(directConversations.id, directConversationMembers.conversationId))
    .where(eq(directConversationMembers.userId, userId)).orderBy(desc(directConversations.updatedAt));
  if (memberships.length === 0) return [];
  const conversations = memberships.map((row: typeof memberships[number]) => row.conversation);
  const ids = conversations.map((row: typeof conversations[number]) => row.id);
  const partnerIds = conversations.map((row: typeof conversations[number]) => row.participantAUserId === userId ? row.participantBUserId : row.participantAUserId);
  const identityMap = await identityForUserIds(partnerIds);
  const messages = await db.select().from(directMessages).where(inArray(directMessages.conversationId, ids)).orderBy(desc(directMessages.createdAt));
  const reads = await db.select().from(directMessageReadStates).where(and(eq(directMessageReadStates.userId, userId), inArray(directMessageReadStates.conversationId, ids)));
  const readMap = new Map(reads.map((row: typeof reads[number]) => [row.conversationId, row.lastReadAt?.getTime() ?? 0]));
  const latest = new Map<string, typeof messages[number]>();
  for (const message of messages) if (!latest.has(message.conversationId)) latest.set(message.conversationId, message);
  const blocked = await db.select().from(participantBlocks).where(or(eq(participantBlocks.blockerUserId, userId), eq(participantBlocks.blockedUserId, userId)));
  const blockedIds = new Set(blocked.map((row: typeof blocked[number]) => row.blockerUserId === userId ? row.blockedUserId : row.blockerUserId));
  return conversations.map((conversation: typeof conversations[number]) => {
    const partnerId = conversation.participantAUserId === userId ? conversation.participantBUserId : conversation.participantAUserId;
    const last = latest.get(conversation.id);
    const readAt = readMap.get(conversation.id) ?? 0;
    const unreadCount = messages.filter((message: typeof messages[number]) => message.conversationId === conversation.id && message.authorUserId !== userId && message.createdAt.getTime() > readAt).length;
    const isBlocked = blockedIds.has(partnerId);
    return {
      id: conversation.id,
      participant: identityMap.get(partnerId) ?? identityFromRow({ accountName: null, profileName: null, profileHandle: null, profileHeadline: null, profileAffiliation: null, profileVisibility: null, profileDeactivatedAt: new Date(), accountStatus: "disabled" }),
      latestMessage: last?.body.slice(0, 140) ?? null,
      latestMessageAt: last?.createdAt.toISOString() ?? null,
      unreadCount,
      canSend: !isBlocked && !(identityMap.get(partnerId)?.isFormerParticipant ?? true),
      blocked: isBlocked,
    } satisfies DirectConversationSummary;
  });
}

export async function listDirectMessages(input: { conversationId: string; userId: string; before?: Date; limit?: number }) {
  const access = await resolveDirectConversationAccess(input);
  const limit = Math.min(Math.max(input.limit ?? DIRECT_MESSAGE_PAGE_SIZE, 1), DIRECT_MESSAGE_PAGE_SIZE);
  const rows = await db.select({ message: directMessages }).from(directMessages).where(and(
    eq(directMessages.conversationId, input.conversationId),
    input.before ? lt(directMessages.createdAt, input.before) : undefined,
  )).orderBy(desc(directMessages.createdAt)).limit(limit);
  const authors = await identityForUserIds(rows.map((row: typeof rows[number]) => row.message.authorUserId));
  return {
    access,
    messages: rows.reverse().map((row: typeof rows[number]) => ({
      id: row.message.id,
      author: row.message.authorUserId === input.userId ? "self" : (authors.get(row.message.authorUserId)?.isFormerParticipant ? "former_participant" : "participant"),
      authorIdentity: authors.get(row.message.authorUserId) ?? access.participant,
      body: row.message.body,
      createdAt: row.message.createdAt.toISOString(),
    } satisfies DirectMessageProjection)),
    hasMore: rows.length === limit,
  };
}

export async function postDirectMessage(input: { conversationId: string; userId: string; body: unknown; clientMessageId: unknown }) {
  const access = await resolveDirectConversationAccess(input);
  if (!access.canSend) throw new DirectMessagingError(access.blocked ? "message_blocked" : "recipient_unavailable");
  const body = normalizeBody(input.body);
  const clientMessageId = normalizeClientMessageId(input.clientMessageId);
  const existing = await db.select().from(directMessages).where(and(eq(directMessages.conversationId, input.conversationId), eq(directMessages.authorUserId, input.userId), eq(directMessages.clientMessageId, clientMessageId))).limit(1);
  if (existing[0]) {
    if (existing[0].body !== body) throw new DirectMessagingError("message_conflict");
    return existing[0];
  }
  const now = new Date();
  const id = `dmmsg_${nanoid(20)}`;
  try {
    db.transaction((tx: typeof db) => {
      tx.insert(directMessages).values({ id, conversationId: input.conversationId, authorUserId: input.userId, body, clientMessageId, createdAt: now }).run();
      tx.insert(directMessageEvents).values({ id: eventId(), conversationId: input.conversationId, eventType: "message_created", messageId: id, actorUserId: input.userId, createdAt: now }).run();
      tx.update(directConversations).set({ updatedAt: now }).where(eq(directConversations.id, input.conversationId)).run();
      tx.insert(auditEvents).values({ id: nanoid(), entityType: "direct_message", entityId: id, action: "direct_message_created", actorType: "user", actorId: input.userId, metadata: { conversationId: input.conversationId }, createdAt: now }).run();
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const raced = await db.select().from(directMessages).where(and(eq(directMessages.conversationId, input.conversationId), eq(directMessages.authorUserId, input.userId), eq(directMessages.clientMessageId, clientMessageId))).limit(1);
    if (raced[0] && raced[0].body === body) return raced[0];
    throw new DirectMessagingError("message_conflict");
  }
  return (await db.select().from(directMessages).where(eq(directMessages.id, id)).limit(1))[0];
}

export async function markDirectConversationRead(input: { conversationId: string; userId: string; messageId?: string }) {
  const access = await resolveDirectConversationAccess(input);
  const latest = input.messageId
    ? (await db.select().from(directMessages).where(and(eq(directMessages.id, input.messageId), eq(directMessages.conversationId, input.conversationId))).limit(1))[0]
    : (await db.select().from(directMessages).where(eq(directMessages.conversationId, input.conversationId)).orderBy(desc(directMessages.createdAt)).limit(1))[0];
  if (!latest) return { ok: true };
  const now = new Date();
  await db.insert(directMessageReadStates).values({ id: `dmread_${nanoid(20)}`, conversationId: access.id, userId: input.userId, lastReadMessageId: latest.id, lastReadAt: latest.createdAt, updatedAt: now })
    .onConflictDoUpdate({ target: [directMessageReadStates.conversationId, directMessageReadStates.userId], set: { lastReadMessageId: latest.id, lastReadAt: latest.createdAt, updatedAt: now } });
  return { ok: true };
}

export async function getDirectMessageEvents(input: { conversationId: string; userId: string; after?: string }) {
  const access = await resolveDirectConversationAccess(input);
  let afterCondition;
  if (input.after) {
    const separator = input.after.indexOf("|");
    const timestamp = separator > 0 ? Number(input.after.slice(0, separator)) : Number.NaN;
    const eventIdAfter = separator > 0 ? input.after.slice(separator + 1) : "";
    if (Number.isFinite(timestamp) && eventIdAfter) {
      const afterDate = new Date(timestamp);
      afterCondition = or(
        gt(directMessageEvents.createdAt, afterDate),
        and(eq(directMessageEvents.createdAt, afterDate), gt(directMessageEvents.id, eventIdAfter)),
      );
    }
  }
  const rows = await db.select({ event: directMessageEvents, message: directMessages }).from(directMessageEvents)
    .innerJoin(directMessages, eq(directMessages.id, directMessageEvents.messageId))
    .where(and(eq(directMessageEvents.conversationId, access.id), afterCondition))
    .orderBy(asc(directMessageEvents.createdAt), asc(directMessageEvents.id)).limit(100);
  const authors = await identityForUserIds(rows.map((row: typeof rows[number]) => row.message.authorUserId));
  return rows.map((row: typeof rows[number]) => ({
    cursor: `${row.event.createdAt.getTime()}|${row.event.id}`,
    message: {
      id: row.message.id,
      author: row.message.authorUserId === input.userId ? "self" : "participant",
      authorIdentity: authors.get(row.message.authorUserId) ?? access.participant,
      body: row.message.body,
      createdAt: row.message.createdAt.toISOString(),
    } satisfies DirectMessageProjection,
  }));
}

export async function blockParticipant(input: { blockerUserId: string; blockedUserId: string }) {
  if (input.blockerUserId === input.blockedUserId) throw new DirectMessagingError("self_message");
  const now = new Date();
  await db.insert(participantBlocks).values({ blockerUserId: input.blockerUserId, blockedUserId: input.blockedUserId, createdAt: now }).onConflictDoNothing();
  await db.insert(auditEvents).values({ id: nanoid(), entityType: "participant_block", entityId: `${input.blockerUserId}:${input.blockedUserId}`, action: "participant_blocked", actorType: "user", actorId: input.blockerUserId, metadata: {}, createdAt: now });
  return { ok: true };
}

export async function unblockParticipant(input: { blockerUserId: string; blockedUserId: string }) {
  await db.delete(participantBlocks).where(and(eq(participantBlocks.blockerUserId, input.blockerUserId), eq(participantBlocks.blockedUserId, input.blockedUserId)));
  await db.insert(auditEvents).values({ id: nanoid(), entityType: "participant_block", entityId: `${input.blockerUserId}:${input.blockedUserId}`, action: "participant_unblocked", actorType: "user", actorId: input.blockerUserId, metadata: {}, createdAt: new Date() });
  return { ok: true };
}

export async function reportDirectConversation(input: { conversationId: string; reporterUserId: string; category: unknown; reason?: unknown }) {
  await resolveDirectConversationAccess({ conversationId: input.conversationId, userId: input.reporterUserId });
  if (input.category !== "harassment" && input.category !== "spam" && input.category !== "other") throw new DirectMessagingError("invalid_report");
  if (input.reason !== undefined && input.reason !== null && (typeof input.reason !== "string" || input.reason.trim().length > 500)) throw new DirectMessagingError("invalid_report");
  const row = { id: `dmreport_${nanoid(20)}`, conversationId: input.conversationId, reporterUserId: input.reporterUserId, category: input.category, reason: typeof input.reason === "string" ? input.reason.trim() || null : null, status: "open" as const, createdAt: new Date() };
  await db.insert(directMessageReports).values(row);
  await db.insert(auditEvents).values({ id: nanoid(), entityType: "direct_message_report", entityId: row.id, action: "direct_message_reported", actorType: "user", actorId: input.reporterUserId, metadata: { conversationId: input.conversationId, category: input.category }, createdAt: row.createdAt });
  return { id: row.id };
}

export async function getDirectUnreadCount(userId: string) {
  try {
    const memberships = await db.select({ conversationId: directConversationMembers.conversationId })
      .from(directConversationMembers).where(eq(directConversationMembers.userId, userId));
    if (!memberships.length) return 0;
    const ids = memberships.map((row: typeof memberships[number]) => row.conversationId);
    const reads = await db.select().from(directMessageReadStates).where(and(eq(directMessageReadStates.userId, userId), inArray(directMessageReadStates.conversationId, ids)));
    const readMap = new Map(reads.map((row: typeof reads[number]) => [row.conversationId, row.lastReadAt?.getTime() ?? 0]));
    const messages = await db.select({ conversationId: directMessages.conversationId, createdAt: directMessages.createdAt, authorUserId: directMessages.authorUserId }).from(directMessages).where(inArray(directMessages.conversationId, ids));
    return messages.filter((row: typeof messages[number]) => row.authorUserId !== userId && row.createdAt.getTime() > (readMap.get(row.conversationId) ?? 0)).length;
  } catch (error) {
    if (error instanceof Error && /no such table.*direct_/i.test(error.message)) return 0;
    throw error;
  }
}
