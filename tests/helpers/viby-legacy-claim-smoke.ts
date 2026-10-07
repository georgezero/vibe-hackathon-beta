export {};

async function main() {
  const { db } = await import("../../lib/db");
  const {
    users,
    sessions,
    adminAuthorizations,
    vibyIdentityLinks,
    vibyIdentityLinkTransactions,
  } = await import("../../lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const {
    cancelPendingVibyLink,
    classifyVibyIdentity,
    confirmPendingVibyLink,
    createPendingVibyLink,
    preparePendingVibyLink,
  } = await import("../../lib/viby-interactive-linking");
  const now = new Date();
  for (const id of ["claim-user-1", "claim-user-2", "claim-user-3", "claim-user-4"]) {
    await db.insert(users).values({
      id,
      name: id,
      email: `${id}@example.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(sessions).values({
      id: `session-${id}`,
      token: `token-${id}`,
      userId: id,
      expiresAt: new Date(now.getTime() + 3_600_000),
      createdAt: now,
      updatedAt: now,
    });
  }

  async function insertLegacy(id: string, subject: string) {
    await db.insert(vibyIdentityLinks).values({
      id,
      providerId: "viby",
      subjectId: subject,
      role: "admin",
      localUserId: null,
      applicationId: "vibe-hackathon",
      status: "active",
      linkProvenance: "operator",
      displayName: "Legacy identity",
      lastVerifiedAt: new Date(now.getTime() - 60_000),
      createdAt: new Date(now.getTime() - 120_000),
      updatedAt: new Date(now.getTime() - 60_000),
    });
  }
  async function pending(subject: string) {
    const classification = await classifyVibyIdentity({
      subject,
      applicationId: "vibe-hackathon",
      environment: "https://vibe.example.test",
    });
    if (classification.kind !== "unbound_legacy_claimable") throw new Error(`Not claimable: ${classification.kind}`);
    return createPendingVibyLink({
      subject,
      identitySessionId: `identity-session-${subject}`,
      verifiedAt: now.toISOString(),
      assertionId: `assertion-${subject}`,
      returnTo: "/admin/dashboard",
      environment: "https://vibe.example.test",
      classification,
    });
  }

  await insertLegacy("legacy-link-1", "legacy-subject-1");
  const original = (await db.select().from(vibyIdentityLinks)
    .where(eq(vibyIdentityLinks.id, "legacy-link-1")))[0];
  const first = await pending("legacy-subject-1");
  await preparePendingVibyLink({ token: first.token, browserBinding: first.browserBinding, userId: "claim-user-1" });
  const firstConfirm = await confirmPendingVibyLink({
    token: first.token,
    browserBinding: first.browserBinding,
    userId: "claim-user-1",
    betterAuthSessionId: "session-claim-user-1",
  });
  const claimed = (await db.select().from(vibyIdentityLinks)
    .where(eq(vibyIdentityLinks.id, "legacy-link-1")))[0];
  const replay = await confirmPendingVibyLink({
    token: first.token,
    browserBinding: first.browserBinding,
    userId: "claim-user-1",
    betterAuthSessionId: "session-claim-user-1",
  });

  await insertLegacy("legacy-link-2", "legacy-subject-2");
  const conflict = await pending("legacy-subject-2");
  await preparePendingVibyLink({ token: conflict.token, browserBinding: conflict.browserBinding, userId: "claim-user-1" });
  const conflictResult = await confirmPendingVibyLink({
    token: conflict.token,
    browserBinding: conflict.browserBinding,
    userId: "claim-user-1",
    betterAuthSessionId: "session-claim-user-1",
  });

  await insertLegacy("legacy-link-3", "legacy-subject-3");
  const cancelled = await pending("legacy-subject-3");
  const cancelResult = await cancelPendingVibyLink(cancelled.token, cancelled.browserBinding);
  const cancelledRow = (await db.select().from(vibyIdentityLinks)
    .where(eq(vibyIdentityLinks.id, "legacy-link-3")))[0];

  await insertLegacy("legacy-link-status", "legacy-subject-status");
  const changedStatus = await pending("legacy-subject-status");
  await preparePendingVibyLink({ token: changedStatus.token, browserBinding: changedStatus.browserBinding, userId: "claim-user-3" });
  await db.update(vibyIdentityLinks).set({ status: "revoked", revokedAt: now })
    .where(eq(vibyIdentityLinks.id, "legacy-link-status"));
  const changedStatusResult = await confirmPendingVibyLink({
    token: changedStatus.token,
    browserBinding: changedStatus.browserBinding,
    userId: "claim-user-3",
    betterAuthSessionId: "session-claim-user-3",
  });

  await insertLegacy("legacy-link-owner", "legacy-subject-owner");
  const changedOwner = await pending("legacy-subject-owner");
  await preparePendingVibyLink({ token: changedOwner.token, browserBinding: changedOwner.browserBinding, userId: "claim-user-3" });
  await db.update(vibyIdentityLinks).set({
    localUserId: "claim-user-4",
    environment: "https://vibe.example.test",
    bindingProvenance: "interactive_legacy_claim",
    boundAt: now,
  }).where(eq(vibyIdentityLinks.id, "legacy-link-owner"));
  const changedOwnerResult = await confirmPendingVibyLink({
    token: changedOwner.token,
    browserBinding: changedOwner.browserBinding,
    userId: "claim-user-3",
    betterAuthSessionId: "session-claim-user-3",
  });

  await insertLegacy("legacy-link-4", "legacy-subject-4");
  const raceOne = await pending("legacy-subject-4");
  const raceTwo = await pending("legacy-subject-4");
  for (const item of [raceOne, raceTwo]) {
    await preparePendingVibyLink({ token: item.token, browserBinding: item.browserBinding, userId: "claim-user-2" });
  }
  const raceWinner = await confirmPendingVibyLink({
    token: raceOne.token,
    browserBinding: raceOne.browserBinding,
    userId: "claim-user-2",
    betterAuthSessionId: "session-claim-user-2",
  });
  const raceIdempotent = await confirmPendingVibyLink({
    token: raceTwo.token,
    browserBinding: raceTwo.browserBinding,
    userId: "claim-user-2",
    betterAuthSessionId: "session-claim-user-2",
  });

  const grantCount = (await db.select().from(adminAuthorizations)).length;
  const linkCount = (await db.select().from(vibyIdentityLinks)
    .where(eq(vibyIdentityLinks.subjectId, "legacy-subject-1"))).length;
  const confirmedTransactions = (await db.select().from(vibyIdentityLinkTransactions))
    .filter((item: { status: string }) => item.status === "confirmed").length;
  console.log(JSON.stringify({
    firstConfirmed: firstConfirm.ok,
    sameRowUpdated: claimed.id === original.id && linkCount === 1,
    creationPreserved: claimed.createdAt.getTime() === original.createdAt.getTime()
      && claimed.linkProvenance === original.linkProvenance,
    bindingProvenance: claimed.bindingProvenance,
    boundUser: claimed.localUserId,
    replayRejected: !replay.ok,
    targetConflict: conflictResult.ok ? null : conflictResult.reason,
    cancelled: cancelResult && cancelledRow.localUserId === null,
    statusChanged: changedStatusResult.ok ? null : changedStatusResult.reason,
    ownerChanged: changedOwnerResult.ok ? null : changedOwnerResult.reason,
    concurrentWinner: raceWinner.ok,
    concurrentSameUserIdempotent: raceIdempotent.ok && raceIdempotent.idempotent,
    confirmedTransactions,
    adminGrantsCreated: grantCount,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "legacy claim smoke failed");
  process.exitCode = 1;
});
