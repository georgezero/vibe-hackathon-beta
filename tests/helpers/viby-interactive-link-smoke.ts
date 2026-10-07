export {};

async function main() {
  const { db } = await import("../../lib/db");
  const { users, sessions, adminAuthorizations, vibyIdentityLinks, vibyIdentityLinkTransactions } = await import("../../lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const {
    createPendingVibyLink,
    classifyVibyIdentity,
    preparePendingVibyLink,
    confirmPendingVibyLink,
    cancelPendingVibyLink,
  } = await import("../../lib/viby-interactive-linking");
  const now = new Date();
  for (const id of ["user-1", "user-2"]) {
    await db.insert(users).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
    await db.insert(sessions).values({ id: `session-${id}`, token: `token-${id}`, userId: id, expiresAt: new Date(now.getTime() + 3600000), createdAt: now, updatedAt: now });
  }
  const create = async (subject: string, simulateConcurrentAbsent = false) => {
    const resolved = await classifyVibyIdentity({
      subject,
      applicationId: "vibe-hackathon",
      environment: "https://vibe.example.test",
    });
    const classification = simulateConcurrentAbsent ? { kind: "absent" as const } : resolved;
    if (classification.kind !== "absent" && classification.kind !== "unbound_legacy_claimable") {
      throw new Error(`Unexpected test classification: ${classification.kind}`);
    }
    return createPendingVibyLink({
      subject,
      identitySessionId: `viby-session-${subject}`,
      verifiedAt: now.toISOString(),
      assertionId: `assertion-${subject}`,
      returnTo: "/admin/dashboard",
      environment: "https://vibe.example.test",
      classification,
    });
  };

  const first = await create("viby-subject-1");
  const mismatch = await preparePendingVibyLink({ token: first.token, browserBinding: "wrong", userId: "user-1" });
  const prepared = await preparePendingVibyLink({ token: first.token, browserBinding: first.browserBinding, userId: "user-1" });
  const accountChanged = await confirmPendingVibyLink({ token: first.token, browserBinding: first.browserBinding, userId: "user-2", betterAuthSessionId: "session-user-2" });
  const confirmed = await confirmPendingVibyLink({ token: first.token, browserBinding: first.browserBinding, userId: "user-1", betterAuthSessionId: "session-user-1" });
  const replay = await confirmPendingVibyLink({ token: first.token, browserBinding: first.browserBinding, userId: "user-1", betterAuthSessionId: "session-user-1" });

  const identical = await create("viby-subject-1", true);
  await preparePendingVibyLink({ token: identical.token, browserBinding: identical.browserBinding, userId: "user-1" });
  const idempotent = await confirmPendingVibyLink({ token: identical.token, browserBinding: identical.browserBinding, userId: "user-1", betterAuthSessionId: "session-user-1" });

  const conflictingUser = await create("viby-subject-2");
  await preparePendingVibyLink({ token: conflictingUser.token, browserBinding: conflictingUser.browserBinding, userId: "user-1" });
  const userConflict = await confirmPendingVibyLink({ token: conflictingUser.token, browserBinding: conflictingUser.browserBinding, userId: "user-1", betterAuthSessionId: "session-user-1" });

  await db.update(vibyIdentityLinks).set({ status: "revoked", revokedAt: now }).where(eq(vibyIdentityLinks.subjectId, "viby-subject-1"));
  const revoked = await create("viby-subject-1", true);
  await preparePendingVibyLink({ token: revoked.token, browserBinding: revoked.browserBinding, userId: "user-1" });
  const revokedResult = await confirmPendingVibyLink({ token: revoked.token, browserBinding: revoked.browserBinding, userId: "user-1", betterAuthSessionId: "session-user-1" });

  const cancelled = await create("viby-subject-cancel");
  const cancelResult = await cancelPendingVibyLink(cancelled.token, cancelled.browserBinding);
  const cancelledConfirm = await confirmPendingVibyLink({ token: cancelled.token, browserBinding: cancelled.browserBinding, userId: "user-2", betterAuthSessionId: "session-user-2" });

  const expired = await create("viby-subject-expired");
  await db.update(vibyIdentityLinkTransactions).set({ expiresAt: new Date(now.getTime() - 1000) }).where(eq(vibyIdentityLinkTransactions.id, expired.transaction.id));
  const expiredPrepare = await preparePendingVibyLink({ token: expired.token, browserBinding: expired.browserBinding, userId: "user-2" });

  const grants = await db.select().from(adminAuthorizations);
  console.log(JSON.stringify({
    mismatch: mismatch === null,
    preparedUser: prepared?.expectedUserId,
    accountChanged: accountChanged.ok,
    confirmed: confirmed.ok,
    replay: replay.ok,
    idempotent: idempotent.ok && idempotent.idempotent,
    userConflict: userConflict.ok ? null : userConflict.reason,
    revoked: revokedResult.ok ? null : revokedResult.reason,
    cancelled: cancelResult && !cancelledConfirm.ok,
    expired: expiredPrepare === null,
    adminGrantsCreated: grants.length,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "interactive link test failed");
  process.exitCode = 1;
});
