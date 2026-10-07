import { and, asc, desc, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
  adminAuthorizations,
  auditEvents,
  communityChannelReadStates,
  communityChannels,
  communityMessageEvents,
  communityMessageReports,
  communityMessages,
  events,
  submissionMemberships,
  submissionOwners,
  submissions,
  userAccountControls,
  userProfiles,
  users,
} from "@/lib/db/schema";
import { getActiveEvent } from "@/lib/events";

export const COMMUNITY_MESSAGE_MAX_LENGTH = 4000;
export const COMMUNITY_MESSAGE_CLIENT_ID_MAX_LENGTH = 160;
export const COMMUNITY_PAGE_SIZE = 50;
export const COMMUNITY_CHANNEL_SLUG_MAX_LENGTH = 40;

// Keep event channel routes out of the application namespace so future
// destinations cannot collide with /community/:slug.
export const RESERVED_COMMUNITY_CHANNEL_SLUGS = new Set([
  "admin", "api", "account", "community", "health", "login", "logout",
  "messages", "people", "presentation", "project", "projects", "results",
  "settings", "start", "status", "submit", "winners",
]);

export type CommunityChannelType = "discussion" | "announcements";
export type CommunityPostingPolicy = "participants" | "admins_only";
export type CommunityChannelStatus = "active" | "archived";

export type CommunityParticipantIdentity = {
  displayName: string;
  initials: string;
  handle: string | null;
  headline: string | null;
  affiliation: string | null;
};

export type CommunityMessageProjection = {
  id: string;
  body: string;
  createdAt: string;
  author: CommunityParticipantIdentity;
  isRemoved: boolean;
  canReport: boolean;
  /** Safe viewer-relative presentation state; never exposes the author's ID. */
  isOwn: boolean;
};

export type CommunityChannelSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: CommunityChannelType;
  postingPolicy: CommunityPostingPolicy;
  status: CommunityChannelStatus;
  sortOrder: number;
  unreadCount: number;
  canPost: boolean;
};

export class CommunityChannelError extends Error {
  constructor(public readonly code:
    | "authentication_required"
    | "participant_required"
    | "channel_not_found"
    | "channel_forbidden"
    | "channel_archived"
    | "posting_not_allowed"
    | "invalid_message"
    | "invalid_client_message_id"
    | "message_conflict"
    | "message_not_found"
    | "invalid_cursor"
    | "invalid_report"
    | "admin_required"
    | "invalid_channel"
    | "reserved_channel_slug"
    | "channel_conflict"
    | "rate_limited") {
    super(code);
    this.name = "CommunityChannelError";
  }
}

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : words[0]?.slice(0, 2) || "?").toUpperCase();
}

function normalizeBody(value: unknown) {
  if (typeof value !== "string") throw new CommunityChannelError("invalid_message");
  const body = value.replace(/\r\n?/g, "\n").trim();
  if (!body || body.length > COMMUNITY_MESSAGE_MAX_LENGTH) throw new CommunityChannelError("invalid_message");
  return body;
}

function normalizeClientMessageId(value: unknown) {
  if (typeof value !== "string") throw new CommunityChannelError("invalid_client_message_id");
  const id = value.trim();
  if (!id || id.length > COMMUNITY_MESSAGE_CLIENT_ID_MAX_LENGTH || !/^[A-Za-z0-9._:-]+$/.test(id)) throw new CommunityChannelError("invalid_client_message_id");
  return id;
}

function isUniqueConstraint(error: unknown) {
  return String(error).toUpperCase().includes("UNIQUE CONSTRAINT FAILED") || (error as { code?: string } | null)?.code === "SQLITE_CONSTRAINT_UNIQUE";
}

function publicIdentity(row: {
  accountName: string | null;
  profileName: string | null;
  profileHandle: string | null;
  profileHeadline: string | null;
  profileAffiliation: string | null;
  profileVisibility: string | null;
  accountStatus: string | null;
}): CommunityParticipantIdentity {
  const displayName = row.profileName?.trim() || row.accountName?.trim() || "Participant";
  const publicProfile = row.profileVisibility === "public" && Boolean(row.profileHandle && row.profileName) && row.accountStatus !== "disabled";
  return {
    displayName,
    initials: initialsFor(displayName),
    handle: publicProfile ? row.profileHandle : null,
    headline: publicProfile ? row.profileHeadline : null,
    affiliation: publicProfile ? row.profileAffiliation : null,
  };
}

async function identityMap(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map<string, CommunityParticipantIdentity>();
  const rows = await db.select({
    userId: users.id,
    accountName: users.name,
    profileName: userProfiles.displayName,
    profileHandle: userProfiles.handle,
    profileHeadline: userProfiles.headline,
    profileAffiliation: userProfiles.affiliation,
    profileVisibility: userProfiles.visibility,
    accountStatus: userAccountControls.status,
  }).from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(userAccountControls, eq(userAccountControls.userId, users.id))
    .where(inArray(users.id, ids));
  const result = new Map<string, CommunityParticipantIdentity>();
  for (const row of rows) result.set(row.userId, publicIdentity(row));
  return result;
}

async function activeAccount(userId: string) {
  const rows = await db.select({ userId: users.id, status: userAccountControls.status })
    .from(users).leftJoin(userAccountControls, eq(userAccountControls.userId, users.id)).where(eq(users.id, userId)).limit(1);
  return Boolean(rows[0]) && (!rows[0].status || rows[0].status === "active");
}

/** Explicit participation only: owner or active submission membership. */
export async function isEventParticipant(userId: string, eventId: string) {
  const rows = await db.select({ id: submissions.id }).from(submissions)
    .leftJoin(submissionOwners, eq(submissionOwners.submissionId, submissions.id))
    .leftJoin(submissionMemberships, and(
      eq(submissionMemberships.submissionId, submissions.id),
      eq(submissionMemberships.userId, userId),
      eq(submissionMemberships.status, "active"),
    ))
    .where(and(eq(submissions.eventId, eventId), or(eq(submissionOwners.userId, userId), eq(submissionMemberships.userId, userId))))
    .limit(1);
  return Boolean(rows[0]);
}

export async function isCommunityAdmin(userId: string) {
  const rows = await db.select({ id: adminAuthorizations.id }).from(adminAuthorizations)
    .where(and(eq(adminAuthorizations.userId, userId), eq(adminAuthorizations.status, "active"), isNull(adminAuthorizations.revokedAt))).limit(1);
  return Boolean(rows[0]);
}

/**
 * Presentation-only projection of the global social Community policy. Event
 * membership remains relevant to projects and Team Chat, not to ordinary
 * authenticated Community access. Every Community page and API still performs
 * its own authorization and event/channel-scope checks.
 */
export async function canAccessCommunity(userId: string, eventId?: string) {
  void eventId;
  return activeAccount(userId);
}

export async function resolveCommunityChannelAccess(input: { slug: string; userId: string; eventId?: string }) {
  const eventId = input.eventId ?? (await getActiveEvent()).id;
  const rows = await db.select({ channel: communityChannels, event: events }).from(communityChannels)
    .innerJoin(events, eq(events.id, communityChannels.eventId))
    .where(and(eq(communityChannels.eventId, eventId), eq(communityChannels.slug, input.slug.trim().toLowerCase()))).limit(1);
  const row = rows[0];
  if (!row) throw new CommunityChannelError("channel_not_found");
  if (!(await activeAccount(input.userId))) throw new CommunityChannelError("channel_forbidden");
  const admin = await isCommunityAdmin(input.userId);
  return { channel: row.channel, event: row.event, isAdmin: admin };
}

async function unreadForChannel(channelId: string, userId: string, messageIds?: string[]) {
  const state = await db.select({ lastReadAt: communityChannelReadStates.lastReadAt }).from(communityChannelReadStates)
    .where(and(eq(communityChannelReadStates.channelId, channelId), eq(communityChannelReadStates.userId, userId))).limit(1);
  const rows = await db.select({ id: communityMessages.id, authorUserId: communityMessages.authorUserId, createdAt: communityMessages.createdAt }).from(communityMessages)
    .where(and(eq(communityMessages.channelId, channelId), isNull(communityMessages.removedAt), state[0]?.lastReadAt ? gt(communityMessages.createdAt, state[0].lastReadAt) : undefined));
  if (!messageIds) return rows.filter((row: typeof rows[number]) => row.authorUserId !== userId).length;
  return rows.filter((row: typeof rows[number]) => row.authorUserId !== userId && messageIds.includes(row.id)).length;
}

export async function listCommunityChannels(input: { userId: string; eventId?: string }): Promise<CommunityChannelSummary[]> {
  const eventId = input.eventId ?? (await getActiveEvent()).id;
  if (!(await activeAccount(input.userId))) throw new CommunityChannelError("participant_required");
  const rows = await db.select().from(communityChannels).where(eq(communityChannels.eventId, eventId)).orderBy(asc(communityChannels.sortOrder), asc(communityChannels.name));
  const admin = await isCommunityAdmin(input.userId);
  return Promise.all(rows.map(async (channel: typeof rows[number]) => ({
    id: channel.id, slug: channel.slug, name: channel.name, description: channel.description,
    type: channel.type, postingPolicy: channel.postingPolicy, status: channel.status, sortOrder: channel.sortOrder,
    unreadCount: channel.status === "active" ? await unreadForChannel(channel.id, input.userId) : 0,
    canPost: channel.status === "active" && (channel.postingPolicy !== "admins_only" || admin),
  })));
}

export async function listCommunityMessages(input: { slug: string; userId: string; eventId?: string; before?: Date; limit?: number }) {
  const access = await resolveCommunityChannelAccess(input);
  const limit = Math.min(Math.max(input.limit ?? COMMUNITY_PAGE_SIZE, 1), COMMUNITY_PAGE_SIZE);
  const rows = await db.select({ message: communityMessages }).from(communityMessages)
    .where(and(eq(communityMessages.channelId, access.channel.id), input.before ? lt(communityMessages.createdAt, input.before) : undefined))
    .orderBy(desc(communityMessages.createdAt)).limit(limit);
  const identities = await identityMap(rows.map((row: typeof rows[number]) => row.message.authorUserId));
  return {
    access,
    messages: rows.reverse().map(({ message }: typeof rows[number]) => ({
      id: message.id,
      body: message.removedAt ? "Message removed by an organizer." : message.body,
      createdAt: message.createdAt.toISOString(),
      author: identities.get(message.authorUserId) || { displayName: "Participant", initials: "?", handle: null, headline: null, affiliation: null },
      isRemoved: Boolean(message.removedAt),
      canReport: !message.removedAt,
      isOwn: message.authorUserId === input.userId,
    } satisfies CommunityMessageProjection)),
    hasMore: rows.length === limit,
  };
}

export async function postCommunityMessage(input: { slug: string; userId: string; body: unknown; clientMessageId: unknown; eventId?: string }) {
  const access = await resolveCommunityChannelAccess(input);
  if (access.channel.status === "archived") throw new CommunityChannelError("channel_archived");
  if (access.channel.postingPolicy === "admins_only" && !access.isAdmin) throw new CommunityChannelError("posting_not_allowed");
  const body = normalizeBody(input.body);
  const clientMessageId = normalizeClientMessageId(input.clientMessageId);
  const existing = await db.select().from(communityMessages).where(and(eq(communityMessages.channelId, access.channel.id), eq(communityMessages.authorUserId, input.userId), eq(communityMessages.clientMessageId, clientMessageId))).limit(1);
  if (existing[0]) {
    if (existing[0].body !== body) throw new CommunityChannelError("message_conflict");
    return existing[0];
  }
  const now = new Date();
  const id = `cmsg_${nanoid(20)}`;
  try {
    db.transaction((tx: typeof db) => {
      tx.insert(communityMessages).values({ id, channelId: access.channel.id, authorUserId: input.userId, body, clientMessageId, createdAt: now }).run();
      tx.insert(communityMessageEvents).values({ id: `cevent_${nanoid(20)}`, channelId: access.channel.id, eventType: "message_created", messageId: id, actorUserId: input.userId, createdAt: now }).run();
      tx.update(communityChannels).set({ updatedAt: now }).where(eq(communityChannels.id, access.channel.id)).run();
      tx.insert(auditEvents).values({ id: nanoid(), entityType: "community_message", entityId: id, action: "community_message_created", actorType: "user", actorId: input.userId, metadata: { channelId: access.channel.id }, createdAt: now }).run();
    });
  } catch (error) {
    if (!isUniqueConstraint(error)) throw error;
    const raced = await db.select().from(communityMessages).where(and(eq(communityMessages.channelId, access.channel.id), eq(communityMessages.authorUserId, input.userId), eq(communityMessages.clientMessageId, clientMessageId))).limit(1);
    if (raced[0] && raced[0].body === body) return raced[0];
    throw new CommunityChannelError("message_conflict");
  }
  return (await db.select().from(communityMessages).where(eq(communityMessages.id, id)).limit(1))[0];
}

export async function markCommunityChannelRead(input: { slug: string; userId: string; messageId?: string; eventId?: string }) {
  const access = await resolveCommunityChannelAccess(input);
  const latest = input.messageId
    ? (await db.select({ id: communityMessages.id, createdAt: communityMessages.createdAt }).from(communityMessages).where(and(eq(communityMessages.id, input.messageId), eq(communityMessages.channelId, access.channel.id))).limit(1))[0]
    : (await db.select({ id: communityMessages.id, createdAt: communityMessages.createdAt }).from(communityMessages).where(eq(communityMessages.channelId, access.channel.id)).orderBy(desc(communityMessages.createdAt)).limit(1))[0];
  if (input.messageId && !latest) throw new CommunityChannelError("message_not_found");
  const now = new Date();
  const values = { channelId: access.channel.id, userId: input.userId, lastReadMessageId: latest?.id ?? null, lastReadAt: latest?.createdAt ?? now, updatedAt: now };
  await db.insert(communityChannelReadStates).values({ id: `cread_${nanoid(20)}`, ...values }).onConflictDoUpdate({ target: [communityChannelReadStates.channelId, communityChannelReadStates.userId], set: values });
  return { ok: true };
}

export async function getCommunityEvents(input: { slug: string; userId: string; after?: string; eventId?: string }) {
  const access = await resolveCommunityChannelAccess(input);
  let afterCondition;
  if (input.after) {
    const separator = input.after.indexOf("|");
    const timestamp = separator > 0 ? Number(input.after.slice(0, separator)) : Number.NaN;
    const eventIdAfter = separator > 0 ? input.after.slice(separator + 1) : "";
    if (Number.isFinite(timestamp) && eventIdAfter) {
      const afterDate = new Date(timestamp);
      afterCondition = or(gt(communityMessageEvents.createdAt, afterDate), and(eq(communityMessageEvents.createdAt, afterDate), gt(communityMessageEvents.id, eventIdAfter)));
    }
  }
  const rows = await db.select({ event: communityMessageEvents, message: communityMessages }).from(communityMessageEvents)
    .innerJoin(communityMessages, eq(communityMessages.id, communityMessageEvents.messageId))
    .where(and(eq(communityMessageEvents.channelId, access.channel.id), afterCondition)).orderBy(asc(communityMessageEvents.createdAt), asc(communityMessageEvents.id)).limit(100);
  const identities = await identityMap(rows.map((row: typeof rows[number]) => row.message.authorUserId));
  return rows.map((row: typeof rows[number]) => ({ cursor: `${row.event.createdAt.getTime()}|${row.event.id}`, message: {
    id: row.message.id, body: row.message.removedAt ? "Message removed by an organizer." : row.message.body,
    createdAt: row.message.createdAt.toISOString(), author: identities.get(row.message.authorUserId) || { displayName: "Participant", initials: "?", handle: null, headline: null, affiliation: null },
    isRemoved: Boolean(row.message.removedAt), canReport: !row.message.removedAt,
    isOwn: row.message.authorUserId === input.userId,
  } satisfies CommunityMessageProjection }));
}

export async function getCommunityUnreadCount(userId: string, eventId?: string) {
  try {
    const channels = await listCommunityChannels({ userId, eventId });
    return channels.reduce((sum, channel) => sum + channel.unreadCount, 0);
  } catch (error) {
    if (error instanceof CommunityChannelError) return 0;
    throw error;
  }
}

export async function reportCommunityMessage(input: { slug: string; messageId: string; reporterUserId: string; category: unknown; reason?: unknown; eventId?: string }) {
  const access = await resolveCommunityChannelAccess({ slug: input.slug, userId: input.reporterUserId, eventId: input.eventId });
  if (input.category !== "harassment" && input.category !== "spam" && input.category !== "off_topic" && input.category !== "other") throw new CommunityChannelError("invalid_report");
  if (input.reason !== undefined && input.reason !== null && (typeof input.reason !== "string" || input.reason.trim().length > 500)) throw new CommunityChannelError("invalid_report");
  const message = await db.select({ id: communityMessages.id }).from(communityMessages).where(and(eq(communityMessages.id, input.messageId), eq(communityMessages.channelId, access.channel.id))).limit(1);
  if (!message[0]) throw new CommunityChannelError("message_not_found");
  const row = { id: `creport_${nanoid(20)}`, channelId: access.channel.id, messageId: input.messageId, reporterUserId: input.reporterUserId, category: input.category as "harassment" | "spam" | "off_topic" | "other", reason: typeof input.reason === "string" ? input.reason.trim() || null : null, status: "open" as const, createdAt: new Date(), reviewedAt: null, reviewedByUserId: null };
  await db.insert(communityMessageReports).values(row);
  await db.insert(auditEvents).values({ id: nanoid(), entityType: "community_message_report", entityId: row.id, action: "community_message_reported", actorType: "user", actorId: input.reporterUserId, metadata: { channelId: access.channel.id, messageId: input.messageId, category: row.category }, createdAt: row.createdAt });
  return { id: row.id };
}

export async function listCommunityReports(userId: string, eventId?: string) {
  if (!(await isCommunityAdmin(userId))) throw new CommunityChannelError("admin_required");
  const currentEventId = eventId ?? (await getActiveEvent()).id;
  return db.select({ report: communityMessageReports, channel: communityChannels, message: communityMessages, author: users })
    .from(communityMessageReports).innerJoin(communityChannels, eq(communityChannels.id, communityMessageReports.channelId))
    .innerJoin(communityMessages, eq(communityMessages.id, communityMessageReports.messageId)).innerJoin(users, eq(users.id, communityMessages.authorUserId))
    .where(eq(communityChannels.eventId, currentEventId)).orderBy(desc(communityMessageReports.createdAt));
}

export async function setCommunityMessageRemoved(input: { messageId: string; adminUserId: string; removed: boolean; eventId?: string }) {
  if (!(await isCommunityAdmin(input.adminUserId))) throw new CommunityChannelError("admin_required");
  const currentEventId = input.eventId ?? (await getActiveEvent()).id;
  const row = await db.select({ message: communityMessages, channel: communityChannels }).from(communityMessages).innerJoin(communityChannels, eq(communityChannels.id, communityMessages.channelId)).where(and(eq(communityMessages.id, input.messageId), eq(communityChannels.eventId, currentEventId))).limit(1);
  if (!row[0]) throw new CommunityChannelError("message_not_found");
  const now = input.removed ? new Date() : null;
  await db.update(communityMessages).set({ removedAt: now, removedByUserId: input.removed ? input.adminUserId : null }).where(eq(communityMessages.id, input.messageId));
  await db.insert(auditEvents).values({ id: nanoid(), entityType: "community_message", entityId: input.messageId, action: input.removed ? "community_message_removed" : "community_message_restored", actorType: "user", actorId: input.adminUserId, metadata: { channelId: row[0].channel.id }, createdAt: new Date() });
  return { ok: true };
}

export async function updateCommunityChannel(input: { channelId: string; adminUserId: string; eventId?: string; name?: string; slug?: string; description?: string; status?: CommunityChannelStatus; sortOrder?: number }) {
  if (!(await isCommunityAdmin(input.adminUserId))) throw new CommunityChannelError("admin_required");
  const eventId = input.eventId ?? (await getActiveEvent()).id;
  const row = await db.select().from(communityChannels).where(and(eq(communityChannels.id, input.channelId), eq(communityChannels.eventId, eventId))).limit(1);
  if (!row[0]) throw new CommunityChannelError("channel_not_found");
  const name = input.name?.trim() || row[0].name;
  const description = input.description?.trim() || row[0].description;
  if (name.length > 80 || !description || description.length > 240) throw new CommunityChannelError("invalid_channel");
  const now = new Date();
  try {
    await db.update(communityChannels).set({ name, description, status: input.status ?? row[0].status, sortOrder: input.sortOrder ?? row[0].sortOrder, updatedAt: now }).where(eq(communityChannels.id, input.channelId));
  } catch (error) { if (isUniqueConstraint(error)) throw new CommunityChannelError("channel_conflict"); throw error; }
  await db.insert(auditEvents).values({ id: nanoid(), entityType: "community_channel", entityId: input.channelId, action: input.status === "archived" ? "community_channel_archived" : input.status === "active" ? "community_channel_unarchived" : "community_channel_updated", actorType: "user", actorId: input.adminUserId, metadata: {}, createdAt: now });
  return (await db.select().from(communityChannels).where(eq(communityChannels.id, input.channelId)).limit(1))[0];
}

export async function createCommunityChannel(input: { adminUserId: string; eventId?: string; slug: string; name: string; description: string; type?: CommunityChannelType; postingPolicy?: CommunityPostingPolicy; sortOrder?: number }) {
  if (!(await isCommunityAdmin(input.adminUserId))) throw new CommunityChannelError("admin_required");
  const eventId = input.eventId ?? (await getActiveEvent()).id;
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > COMMUNITY_CHANNEL_SLUG_MAX_LENGTH || !input.name.trim() || !input.description.trim()) throw new CommunityChannelError("invalid_channel");
  if (RESERVED_COMMUNITY_CHANNEL_SLUGS.has(slug)) throw new CommunityChannelError("reserved_channel_slug");
  const now = new Date();
  const row = { id: `channel_${nanoid(16)}`, eventId, slug, name: input.name.trim().slice(0, 80), description: input.description.trim().slice(0, 240), type: input.type ?? "discussion" as const, visibility: "participants" as const, postingPolicy: input.postingPolicy ?? "participants" as const, status: "active" as const, sortOrder: input.sortOrder ?? 0, createdByUserId: input.adminUserId, createdAt: now, updatedAt: now };
  try { await db.insert(communityChannels).values(row); } catch (error) { if (isUniqueConstraint(error)) throw new CommunityChannelError("channel_conflict"); throw error; }
  await db.insert(auditEvents).values({ id: nanoid(), entityType: "community_channel", entityId: row.id, action: "community_channel_created", actorType: "user", actorId: input.adminUserId, metadata: { eventId, slug }, createdAt: now });
  return row;
}
