import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accounts,
  accountInvitations,
  adminAuthorizations,
  auditEvents,
  judgeAuthorizations,
  judges,
  sessions,
  userAccountControls,
  users,
  vibyIdentityLinks,
} from "@/lib/db/schema";
import { DEFAULT_ACCOUNT_CONTROL } from "@/lib/account-controls";

export interface AccountSessionView {
  id: string;
  current: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  device: string;
  locationHint: string | null;
}

export interface AccountOverview {
  profile: {
    name: string;
    email: string;
    createdAt: Date;
    lastSignInAt: Date | null;
  };
  authentication: {
    hasPassword: boolean;
    hasViby: boolean;
    vibyDisplayName: string | null;
    providers: string[];
  };
  account: {
    status: "active" | "disabled";
    passwordChangeRequired: boolean;
    passwordChangedAt: Date | null;
  };
  access: {
    isAdmin: boolean;
    isJudge: boolean;
    eventName: string | null;
  };
  sessions: AccountSessionView[];
}

function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown browser";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  const platform = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Macintosh/.test(userAgent)
        ? "macOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  return platform ? `${browser} on ${platform}` : browser;
}

export async function getAccountOverview(input: {
  userId: string;
  sessionId: string;
  eventId?: string;
  eventName?: string | null;
}): Promise<AccountOverview | null> {
  const userRows = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    createdAt: users.createdAt,
    status: userAccountControls.status,
    passwordChangeRequired: userAccountControls.passwordChangeRequired,
    passwordChangedAt: userAccountControls.passwordChangedAt,
  }).from(users)
    .leftJoin(
      userAccountControls,
      eq(userAccountControls.userId, users.id),
    )
    .where(eq(users.id, input.userId))
    .limit(2);
  if (userRows.length !== 1) return null;
  const user = userRows[0];

  const [accountRows, sessionRows, adminRows, judgeRows, linkRows] = await Promise.all([
    db.select({
      providerId: accounts.providerId,
      hasPassword: accounts.password,
    }).from(accounts).where(eq(accounts.userId, input.userId)),
    db.select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      expiresAt: sessions.expiresAt,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
    }).from(sessions)
      .where(eq(sessions.userId, input.userId))
      .orderBy(desc(sessions.updatedAt)),
    db.select({ id: adminAuthorizations.id })
      .from(adminAuthorizations)
      .where(and(
        eq(adminAuthorizations.userId, input.userId),
        eq(adminAuthorizations.status, "active"),
        isNull(adminAuthorizations.revokedAt),
      ))
      .limit(2),
    input.eventId
      ? db.select({ id: judgeAuthorizations.id })
        .from(judgeAuthorizations)
        .where(and(
          eq(judgeAuthorizations.userId, input.userId),
          eq(judgeAuthorizations.eventId, input.eventId),
          eq(judgeAuthorizations.status, "active"),
          isNull(judgeAuthorizations.revokedAt),
        ))
        .limit(2)
      : Promise.resolve([]),
    db.select({
      displayName: vibyIdentityLinks.displayName,
    }).from(vibyIdentityLinks)
      .where(and(
        eq(vibyIdentityLinks.localUserId, input.userId),
        eq(vibyIdentityLinks.status, "active"),
        isNull(vibyIdentityLinks.revokedAt),
      ))
      .limit(2),
  ]);

  const control = user.status
    ? {
      status: user.status,
      passwordChangeRequired: Boolean(user.passwordChangeRequired),
      passwordChangedAt: user.passwordChangedAt ?? null,
    }
    : DEFAULT_ACCOUNT_CONTROL;
  const typedAccountRows = accountRows as Array<{ providerId: string; hasPassword: string | null }>;
  const typedSessionRows = sessionRows as Array<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }>;
  const providers = Array.from(new Set(typedAccountRows.map((row) => row.providerId)));
  return {
    profile: {
      name: user.name?.trim() || user.email,
      email: user.email,
      createdAt: user.createdAt,
      lastSignInAt: typedSessionRows[0]?.createdAt ?? null,
    },
    authentication: {
      hasPassword: typedAccountRows.some((row) =>
        row.providerId === "credential" && Boolean(row.hasPassword)
      ),
      hasViby: linkRows.length === 1,
      vibyDisplayName: linkRows.length === 1 ? linkRows[0].displayName : null,
      providers,
    },
    account: {
      status: control.status,
      passwordChangeRequired: control.passwordChangeRequired,
      passwordChangedAt: "passwordChangedAt" in control ? control.passwordChangedAt : null,
    },
    access: {
      isAdmin: adminRows.length === 1,
      isJudge: judgeRows.length === 1,
      eventName: input.eventName ?? null,
    },
    sessions: typedSessionRows.map((session) => ({
      id: session.id,
      current: session.id === input.sessionId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
      device: describeDevice(session.userAgent),
      locationHint: session.ipAddress ? "Known network" : null,
    })),
  };
}

export interface PersonDirectoryRow {
  userId: string;
  name: string;
  email: string;
  createdAt: Date;
  lastSignInAt: Date | null;
  status: "active" | "disabled";
  passwordChangeRequired: boolean;
  passwordChangedAt: Date | null;
  sessionCount: number;
  linkedViby: boolean;
  authenticationMethods: Array<"password" | "github" | "viby">;
  adminAccess: boolean;
  judgeAccess: boolean;
  judgeAuthorizationId: string | null;
  judgeProfileId: string | null;
  invitation: {
    id: string;
    status: "pending" | "accepted" | "expired" | "revoked";
    expiresAt: Date;
    createdAt: Date;
  } | null;
  recentAudit: Array<{ action: string; createdAt: Date; result: string | null }>;
}

export async function listPeopleAndAccess(eventId: string) {
  const [
    userRows,
    providerRows,
    sessionRows,
    adminRows,
    judgeRows,
    linkRows,
    judgeProfileRows,
    invitationRows,
    auditRows,
  ] = await Promise.all([
    db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      status: userAccountControls.status,
      passwordChangeRequired: userAccountControls.passwordChangeRequired,
      passwordChangedAt: userAccountControls.passwordChangedAt,
    }).from(users).leftJoin(
      userAccountControls,
      eq(userAccountControls.userId, users.id),
    ),
    db.select({
      userId: accounts.userId,
      providerId: accounts.providerId,
      password: accounts.password,
    }).from(accounts),
    db.select({
      userId: sessions.userId,
      createdAt: sessions.createdAt,
    }).from(sessions).orderBy(desc(sessions.createdAt)),
    db.select({ userId: adminAuthorizations.userId })
      .from(adminAuthorizations)
      .where(and(
        eq(adminAuthorizations.status, "active"),
        isNull(adminAuthorizations.revokedAt),
      )),
    db.select({
      id: judgeAuthorizations.id,
      userId: judgeAuthorizations.userId,
      judgeId: judgeAuthorizations.judgeId,
    }).from(judgeAuthorizations)
      .where(and(
        eq(judgeAuthorizations.eventId, eventId),
        eq(judgeAuthorizations.status, "active"),
        isNull(judgeAuthorizations.revokedAt),
      )),
    db.select({ userId: vibyIdentityLinks.localUserId })
      .from(vibyIdentityLinks)
      .where(and(
        eq(vibyIdentityLinks.status, "active"),
        isNull(vibyIdentityLinks.revokedAt),
      )),
    db.select({
      id: judges.id,
      name: judges.name,
      email: judges.email,
    }).from(judges),
    db.select().from(accountInvitations).orderBy(desc(accountInvitations.createdAt)),
    db.select({
      entityId: auditEvents.entityId,
      action: auditEvents.action,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
    }).from(auditEvents).where(or(
      eq(auditEvents.entityType, "user_account"),
      eq(auditEvents.entityType, "account_invitation"),
    ))
      .orderBy(desc(auditEvents.createdAt)).limit(200),
  ]);
  const typedUserRows = userRows as Array<{
    id: string;
    name: string | null;
    email: string;
    createdAt: Date;
    status: "active" | "disabled" | null;
    passwordChangeRequired: boolean | null;
    passwordChangedAt: Date | null;
  }>;
  const typedAdminRows = adminRows as Array<{ userId: string }>;
  const typedJudgeRows = judgeRows as Array<{
    id: string;
    userId: string;
    judgeId: string;
  }>;
  const typedJudgeProfileRows = judgeProfileRows as Array<{
    id: string;
    name: string;
    email: string;
  }>;

  const providerMap = new Map<string, Set<"password" | "github" | "viby">>();
  const methodSet = (userId: string) => {
    const existing = providerMap.get(userId);
    if (existing) return existing;
    const created = new Set<"password" | "github" | "viby">();
    providerMap.set(userId, created);
    return created;
  };
  for (const provider of providerRows) {
    if (provider.providerId === "credential" && provider.password) {
      methodSet(provider.userId).add("password");
    } else if (provider.providerId === "github") {
      methodSet(provider.userId).add("github");
    }
  }
  for (const link of linkRows) {
    if (link.userId) methodSet(link.userId).add("viby");
  }
  const lastSignIn = new Map<string, Date>();
  const sessionCounts = new Map<string, number>();
  for (const session of sessionRows) {
    sessionCounts.set(session.userId, (sessionCounts.get(session.userId) ?? 0) + 1);
    if (!lastSignIn.has(session.userId)) {
      lastSignIn.set(session.userId, session.createdAt);
    }
  }
  const admins = new Set(typedAdminRows.map((row) => row.userId));
  const judgeByUser = new Map(typedJudgeRows.map((row) => [row.userId, row]));
  const invitationByUser = new Map<string, typeof accountInvitations.$inferSelect>();
  for (const invitation of invitationRows as Array<typeof accountInvitations.$inferSelect>) {
    if (!invitationByUser.has(invitation.userId)) invitationByUser.set(invitation.userId, invitation);
  }
  const auditByUser = new Map<string, Array<{ action: string; createdAt: Date; result: string | null }>>();
  for (const row of auditRows as Array<{ entityId: string; action: string; metadata: unknown; createdAt: Date }>) {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    const target = typeof metadata.targetUserId === "string" ? metadata.targetUserId : row.entityId;
    const values = auditByUser.get(target) ?? [];
    if (values.length < 10) values.push({ action: row.action, createdAt: row.createdAt, result: typeof metadata.result === "string" ? metadata.result : null });
    auditByUser.set(target, values);
  }
  const people: PersonDirectoryRow[] = typedUserRows.map((user) => {
    const judge = judgeByUser.get(user.id);
    const invitation = invitationByUser.get(user.id);
    const invitationStatus = invitation
      ? invitation.status === "pending" && invitation.expiresAt.getTime() <= Date.now()
        ? "expired" as const
        : invitation.status
      : null;
    const methods = Array.from(providerMap.get(user.id) ?? []);
    return {
      userId: user.id,
      name: user.name?.trim() || user.email,
      email: user.email,
      createdAt: user.createdAt,
      lastSignInAt: lastSignIn.get(user.id) ?? null,
      status: user.status ?? "active",
      passwordChangeRequired: Boolean(user.passwordChangeRequired),
      passwordChangedAt: user.passwordChangedAt ?? null,
      sessionCount: sessionCounts.get(user.id) ?? 0,
      linkedViby: methods.includes("viby"),
      authenticationMethods: methods,
      adminAccess: admins.has(user.id),
      judgeAccess: Boolean(judge),
      judgeAuthorizationId: judge?.id ?? null,
      judgeProfileId: judge?.judgeId ?? null,
      invitation: invitation ? {
        id: invitation.id,
        status: invitationStatus!,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      } : null,
      recentAudit: auditByUser.get(user.id) ?? [],
    };
  });
  const assignedJudgeIds = new Set(typedJudgeRows.map((row) => row.judgeId));
  return {
    people,
    judgeProfiles: typedJudgeProfileRows.map((judge) => ({
      id: judge.id,
      name: judge.name,
      email: judge.email,
      available: !assignedJudgeIds.has(judge.id),
    })),
  };
}
