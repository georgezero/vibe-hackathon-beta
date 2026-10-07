import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  auditEvents,
  chatEvents,
  chatMessages,
  chatReadStates,
  chatRooms,
  submissionMemberships,
  submissions,
  users,
} from "@/lib/db/schema";
import { resolveSubmissionMembership } from "@/lib/submission-memberships";
import { isNativeTeamChatEnabled } from "@/lib/native-chat-config";

export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH = 160;
export const CHAT_SYSTEM_EVENT_TYPES = new Set([
  "submission_created",
  "submission_claimed",
  "teammate_joined",
  "teammate_removed",
  "project_title_changed",
  "preview_updated",
  "submission_finalized",
]);

export type ChatAccessResolution =
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "archived"; room: typeof chatRooms.$inferSelect }
  | { status: "active"; room: typeof chatRooms.$inferSelect; membership: typeof submissionMemberships.$inferSelect };

/**
 * Feature-gate a room by its authoritative submission mapping.  Room-scoped
 * endpoints must use this instead of the global flag so a controlled pilot
 * allowlist works for unread/read/SSE as well as history and posting.
 */
export async function isNativeChatRoomEnabled(roomId: string) {
  const rows = await db.select({ submissionId: chatRooms.submissionId })
    .from(chatRooms)
    .where(eq(chatRooms.id, roomId))
    .limit(1);
  return rows.length === 1 && isNativeTeamChatEnabled(rows[0].submissionId);
}

export class ChatError extends Error {
  constructor(public readonly code:
    | "submission_not_found"
    | "membership_required"
    | "room_not_found"
    | "room_archived"
    | "invalid_message"
    | "invalid_client_message_id"
    | "message_conflict"
    | "message_not_found"
    | "message_not_owned"
    | "edit_window_expired"
    | "read_state_forbidden"
    | "room_creation_conflict") {
    super(code);
    this.name = "ChatError";
  }
}

function normalizeBody(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function validateClientMessageId(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new ChatError("invalid_client_message_id");
  }
  return normalized;
}

export async function resolveChatRoomAccess(input: {
  roomId: string;
  userId: string;
}): Promise<ChatAccessResolution> {
  const rows = await db.select({ room: chatRooms, membership: submissionMemberships })
    .from(chatRooms)
    .leftJoin(submissionMemberships, and(
      eq(submissionMemberships.submissionId, chatRooms.submissionId),
      eq(submissionMemberships.userId, input.userId),
      eq(submissionMemberships.status, "active"),
    ))
    .where(eq(chatRooms.id, input.roomId)).limit(2);
  if (!rows[0]) return { status: "not_found" };
  if (rows.length > 1) return { status: "forbidden" };
  if (rows[0].room.status === "archived") return { status: "archived", room: rows[0].room };
  if (!rows[0].membership) return { status: "forbidden" };
  return { status: "active", room: rows[0].room, membership: rows[0].membership };
}

export async function getOrCreateSubmissionChatRoom(submissionId: string) {
  const submission = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.id, submissionId)).limit(1);
  if (!submission[0]) throw new ChatError("submission_not_found");
  const owner = await db.select({ id: submissionMemberships.id }).from(submissionMemberships).where(and(
    eq(submissionMemberships.submissionId, submissionId),
    eq(submissionMemberships.role, "owner"),
    eq(submissionMemberships.status, "active"),
  )).limit(2);
  if (owner.length !== 1) throw new ChatError("membership_required");
  const existing = await db.select().from(chatRooms).where(eq(chatRooms.submissionId, submissionId)).orderBy(desc(chatRooms.createdAt)).limit(2);
  if (existing.length > 1 && existing.some((room: typeof chatRooms.$inferSelect) => room.status === "active")) throw new ChatError("room_creation_conflict");
  if (existing[0]) {
    if (existing[0].status === "archived") throw new ChatError("room_archived");
    return existing[0];
  }
  const now = new Date();
  const id = `room_${nanoid(16)}`;
  try {
    db.transaction((tx: typeof db) => {
      tx.insert(chatRooms).values({ id, submissionId, type: "submission_private", status: "active", createdAt: now, updatedAt: now }).run();
      tx.insert(auditEvents).values({
        id: nanoid(), entityType: "chat_room", entityId: id, action: "chat_room_created", actorType: "system",
        metadata: { submissionId } as unknown as Record<string, unknown>, createdAt: now,
      }).run();
    });
  } catch {
    const reconciled = await db.select().from(chatRooms).where(eq(chatRooms.submissionId, submissionId)).limit(2);
    if (reconciled.length === 1 && reconciled[0].status === "active") return reconciled[0];
    throw new ChatError("room_creation_conflict");
  }
  return (await db.select().from(chatRooms).where(eq(chatRooms.id, id)).limit(1))[0];
}

export async function openSubmissionChat(input: { submissionId: string; userId: string }) {
  const membership = await resolveSubmissionMembership(input);
  if (membership.status !== "active") throw new ChatError("membership_required");
  const room = await getOrCreateSubmissionChatRoom(input.submissionId);
  const access = await resolveChatRoomAccess({ roomId: room.id, userId: input.userId });
  if (access.status !== "active") throw new ChatError(access.status === "archived" ? "room_archived" : "membership_required");
  await db.insert(auditEvents).values({
    id: nanoid(), entityType: "chat_room", entityId: room.id, action: "chat_room_opened", actorType: "user", actorId: input.userId,
    metadata: { submissionId: input.submissionId } as unknown as Record<string, unknown>, createdAt: new Date(),
  });
  return access;
}

export async function listChatMessages(input: { roomId: string; userId: string; before?: Date; limit?: number }) {
  const access = await resolveChatRoomAccess(input);
  if (access.status !== "active") throw new ChatError(access.status === "archived" ? "room_archived" : "membership_required");
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const rows = await db.select({ message: chatMessages, author: users })
    .from(chatMessages)
    .leftJoin(users, eq(users.id, chatMessages.authorUserId))
    .where(and(
      eq(chatMessages.roomId, input.roomId),
      input.before ? lt(chatMessages.createdAt, input.before) : undefined,
    ))
    .orderBy(desc(chatMessages.createdAt)).limit(limit);
  return { access, messages: rows.reverse() };
}

export async function postChatMessage(input: { roomId: string; userId: string; body: string; clientMessageId: string }) {
  const access = await resolveChatRoomAccess(input);
  if (access.status !== "active") throw new ChatError(access.status === "archived" ? "room_archived" : "membership_required");
  const body = normalizeBody(input.body);
  if (!body || body.length > CHAT_MESSAGE_MAX_LENGTH) throw new ChatError("invalid_message");
  const clientMessageId = validateClientMessageId(input.clientMessageId);
  const existing = await db.select().from(chatMessages).where(and(
    eq(chatMessages.roomId, input.roomId),
    eq(chatMessages.authorUserId, input.userId),
    eq(chatMessages.clientMessageId, clientMessageId),
  )).limit(1);
  if (existing[0]) {
    if (existing[0].body !== body || existing[0].messageType !== "user_message") throw new ChatError("message_conflict");
    return existing[0];
  }
  const now = new Date();
  const id = `msg_${nanoid(16)}`;
  try {
    db.transaction((tx: typeof db) => {
      tx.insert(chatMessages).values({ id, roomId: input.roomId, authorUserId: input.userId, messageType: "user_message", body, clientMessageId, createdAt: now }).run();
      tx.insert(chatEvents).values({ id: `event_${nanoid(16)}`, roomId: input.roomId, eventType: "message_created", messageId: id, actorUserId: input.userId, createdAt: now }).run();
      tx.insert(auditEvents).values({
        id: nanoid(), entityType: "chat_message", entityId: id, action: "chat_message_created", actorType: "user", actorId: input.userId,
        metadata: { roomId: input.roomId } as unknown as Record<string, unknown>, createdAt: now,
      }).run();
    });
  } catch {
    const raced = await db.select().from(chatMessages).where(and(eq(chatMessages.roomId, input.roomId), eq(chatMessages.authorUserId, input.userId), eq(chatMessages.clientMessageId, clientMessageId))).limit(1);
    if (raced[0] && raced[0].body === body) return raced[0];
    throw new ChatError("message_conflict");
  }
  return (await db.select().from(chatMessages).where(eq(chatMessages.id, id)).limit(1))[0];
}

export function postSystemChatEvent(input: { roomId: string; eventType: string; body: string; relatedId?: string | null }) {
  if (!CHAT_SYSTEM_EVENT_TYPES.has(input.eventType)) throw new ChatError("invalid_message");
  const body = normalizeBody(input.body);
  if (!body || body.length > CHAT_MESSAGE_MAX_LENGTH) throw new ChatError("invalid_message");
  const now = new Date();
  const id = `msg_${nanoid(16)}`;
  db.transaction((tx: typeof db) => {
    tx.insert(chatMessages).values({ id, roomId: input.roomId, authorUserId: null, messageType: "system_event", body, clientMessageId: `system_${nanoid(16)}`, createdAt: now }).run();
    tx.insert(chatEvents).values({ id: `event_${nanoid(16)}`, roomId: input.roomId, eventType: "message_created", messageId: id, actorUserId: null, createdAt: now }).run();
    tx.insert(auditEvents).values({
      id: nanoid(), entityType: "chat_message", entityId: id, action: "chat_message_created", actorType: "system", actorId: null,
      metadata: { roomId: input.roomId, eventType: input.eventType, relatedId: input.relatedId ?? null } as unknown as Record<string, unknown>, createdAt: now,
    }).run();
  });
  return id;
}

export async function getChatUnreadCount(input: { roomId: string; userId: string }) {
  const access = await resolveChatRoomAccess(input);
  if (access.status !== "active") throw new ChatError("membership_required");
  const state = await db.select().from(chatReadStates).where(and(eq(chatReadStates.roomId, input.roomId), eq(chatReadStates.userId, input.userId))).limit(1);
  const count = await db.select({ id: chatMessages.id }).from(chatMessages).where(and(
    eq(chatMessages.roomId, input.roomId),
    state[0]?.lastReadAt ? gt(chatMessages.createdAt, state[0].lastReadAt) : undefined,
  ));
  return count.length;
}

export async function markChatRead(input: { roomId: string; userId: string; messageId?: string }) {
  const access = await resolveChatRoomAccess(input);
  if (access.status !== "active") throw new ChatError("read_state_forbidden");
  const latest = input.messageId
    ? await db.select({ id: chatMessages.id, createdAt: chatMessages.createdAt }).from(chatMessages).where(and(eq(chatMessages.id, input.messageId), eq(chatMessages.roomId, input.roomId))).limit(1)
    : await db.select({ id: chatMessages.id, createdAt: chatMessages.createdAt }).from(chatMessages).where(eq(chatMessages.roomId, input.roomId)).orderBy(desc(chatMessages.createdAt)).limit(1);
  if (input.messageId && !latest[0]) throw new ChatError("message_not_found");
  const now = new Date();
  const values = { roomId: input.roomId, userId: input.userId, lastReadMessageId: latest[0]?.id ?? null, lastReadAt: latest[0]?.createdAt ?? now, updatedAt: now };
  const current = await db.select({ id: chatReadStates.id }).from(chatReadStates).where(and(eq(chatReadStates.roomId, input.roomId), eq(chatReadStates.userId, input.userId))).limit(1);
  if (current[0]) await db.update(chatReadStates).set(values).where(eq(chatReadStates.id, current[0].id));
  else await db.insert(chatReadStates).values({ id: `read_${nanoid(16)}`, ...values });
  return values;
}

export async function listUserChatRooms(userId: string) {
  return db.select({ room: chatRooms, submission: submissions, membership: submissionMemberships })
    .from(chatRooms)
    .innerJoin(submissions, eq(submissions.id, chatRooms.submissionId))
    .innerJoin(submissionMemberships, and(eq(submissionMemberships.submissionId, chatRooms.submissionId), eq(submissionMemberships.userId, userId), eq(submissionMemberships.status, "active")))
    .where(eq(chatRooms.status, "active"));
}

/**
 * Return unread Team Chat counts for a participant's project cards in one
 * bounded aggregate query.  Access is still resolved through active project
 * membership; no client-provided room or user identity is trusted.
 */
export async function getChatUnreadCountsBySubmission(input: { userId: string; submissionIds: string[] }): Promise<Map<string, number>> {
  const ids = [...new Set(input.submissionIds)].filter(Boolean).filter((id) => isNativeTeamChatEnabled(id));
  if (!ids.length) return new Map<string, number>();
  const rows = await db.select({
    submissionId: chatRooms.submissionId,
    unreadCount: sql<number>`count(${chatMessages.id})`,
  }).from(chatRooms)
    .innerJoin(submissionMemberships, and(
      eq(submissionMemberships.submissionId, chatRooms.submissionId),
      eq(submissionMemberships.userId, input.userId),
      eq(submissionMemberships.status, "active"),
    ))
    .leftJoin(chatReadStates, and(
      eq(chatReadStates.roomId, chatRooms.id),
      eq(chatReadStates.userId, input.userId),
    ))
    .leftJoin(chatMessages, and(
      eq(chatMessages.roomId, chatRooms.id),
      or(isNull(chatReadStates.lastReadAt), gt(chatMessages.createdAt, chatReadStates.lastReadAt)),
    ))
    .where(and(eq(chatRooms.status, "active"), inArray(chatRooms.submissionId, ids)))
    .groupBy(chatRooms.submissionId);
  return new Map(rows.map((row: { submissionId: string; unreadCount: number }) => [row.submissionId, Number(row.unreadCount)]));
}
