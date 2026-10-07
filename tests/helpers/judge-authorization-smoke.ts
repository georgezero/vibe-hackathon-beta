export {};

async function main() {
  const repository = await import("../../lib/judge-authorizations");
  const {
    createApplicationPrincipalResolver,
  } = await import("../../lib/application-principal");

  const none = await repository.resolveActiveJudgeAuthorization("user-judge", "event-1");
  const missingUser = repository.previewJudgeAuthorizationGrant({
    userId: "missing",
    judgeId: "judge-1",
    eventId: "event-1",
    grantProvenance: "test",
  });
  const missingJudge = repository.previewJudgeAuthorizationGrant({
    userId: "user-judge",
    judgeId: "missing",
    eventId: "event-1",
    grantProvenance: "test",
  });
  const missingEvent = repository.previewJudgeAuthorizationGrant({
    userId: "user-judge",
    judgeId: "judge-1",
    eventId: "missing",
    grantProvenance: "test",
  });
  const granted = repository.grantJudgeAuthorization({
    userId: "user-judge",
    judgeId: "judge-1",
    eventId: "event-1",
    grantProvenance: "operator_test",
    grantedByUserId: "user-admin",
  });
  const active = await repository.resolveActiveJudgeAuthorization("user-judge", "event-1");
  const wrongEvent = await repository.resolveActiveJudgeAuthorization("user-judge", "event-2");
  const idempotent = repository.grantJudgeAuthorization({
    userId: "user-judge",
    judgeId: "judge-1",
    eventId: "event-1",
    grantProvenance: "operator_test",
    grantedByUserId: "user-admin",
  });
  const userConflict = repository.grantJudgeAuthorization({
    userId: "user-judge",
    judgeId: "judge-2",
    eventId: "event-1",
    grantProvenance: "operator_test",
  });
  const judgeConflict = repository.grantJudgeAuthorization({
    userId: "user-other",
    judgeId: "judge-1",
    eventId: "event-1",
    grantProvenance: "operator_test",
  });

  const fakeSession = {
    user: {
      id: "user-judge",
      name: "Judge User",
      email: "judge-user@example.test",
      image: null,
    },
    session: {
      id: "session-judge",
      createdAt: new Date(Date.now() - 1_000),
      expiresAt: new Date(Date.now() + 60_000),
    },
  };
  const principalResolver = createApplicationPrincipalResolver({
    getSession: async () => fakeSession,
    getSessionProvenance: async () => ({ status: "absent" }),
    getAdminAuthorization: async () => ({ status: "none" }),
    getJudgeAuthorization: repository.resolveActiveJudgeAuthorization,
  });
  const noContextPrincipal = await principalResolver(new Headers());
  const judgePrincipal = await principalResolver(new Headers(), { eventId: "event-1" });

  const adminJudgeResolver = createApplicationPrincipalResolver({
    getSession: async () => fakeSession,
    getSessionProvenance: async () => ({ status: "absent" }),
    getAdminAuthorization: async () => ({
      status: "active",
      authorization: {
        status: "active",
        grantSource: "operator",
        createdAt: new Date(1),
        updatedAt: new Date(1),
      },
    }),
    getJudgeAuthorization: repository.resolveActiveJudgeAuthorization,
  });
  const adminJudgePrincipal = await adminJudgeResolver(
    new Headers(),
    { eventId: "event-1" },
  );

  const revoked = repository.revokeJudgeAuthorization({
    authorizationId: "authorizationId" in granted ? granted.authorizationId : "",
    reason: "test_revocation",
  });
  const revokedAgain = repository.revokeJudgeAuthorization({
    authorizationId: "authorizationId" in granted ? granted.authorizationId : "",
    reason: "test_revocation",
  });
  const afterRevoke = await repository.resolveActiveJudgeAuthorization(
    "user-judge",
    "event-1",
  );
  repository.recordJudgeAuthorizationInspection("event-1");
  const state = await repository.inspectJudgeAuthorizationState();

  console.log(JSON.stringify({
    none: none.status,
    missingUser,
    missingJudge,
    missingEvent,
    granted: granted.status,
    active: active.status,
    activeJudgeId: active.status === "active" ? active.authorization.judge.id : null,
    wrongEvent: wrongEvent.status,
    idempotent: idempotent.status,
    userConflict,
    judgeConflict,
    noContextRoles: noContextPrincipal.status === "authenticated"
      ? noContextPrincipal.principal.roles
      : null,
    judgeRoles: judgePrincipal.status === "authenticated"
      ? judgePrincipal.principal.roles
      : null,
    adminJudgeRoles: adminJudgePrincipal.status === "authenticated"
      ? adminJudgePrincipal.principal.roles
      : null,
    revoked: revoked.status,
    revokedAgain: revokedAgain.status,
    afterRevoke: afterRevoke.status,
    authorizationHistory: state.authorizations.length,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
