import { verifyPassword } from "better-auth/crypto";
import { db } from "@/lib/db";
import { accounts, auditEvents, sessions } from "@/lib/db/schema";
import {
  AccountManagementError,
  createManagedAccount,
  resetManagedPassword,
  revokeManagedSessions,
  setAccountEnabled,
  setAdministratorAccess,
  setJudgeAccess,
  updateAccountName,
} from "@/lib/account-management";
import { eq } from "drizzle-orm";

async function main() {
  const actorUserId = "operator-user";
  const eventId = "event-current";
  const created = await createManagedAccount({
  actorUserId,
  name: "Managed Person",
  email: "managed@example.test",
  grantAdmin: true,
  grantJudge: true,
  judgeProfileId: "judge-profile-1",
  eventId,
});
  const credential = await db.select({ password: accounts.password })
  .from(accounts)
  .where(eq(accounts.userId, created.userId))
  .limit(1);
  const createdPasswordValid = Boolean(
  credential[0]?.password
  && await verifyPassword({
    hash: credential[0].password,
    password: created.temporaryPassword,
  }),
);

  updateAccountName({
  actorUserId,
  targetUserId: created.userId,
  name: "Managed Person Updated",
});
  setAdministratorAccess({
  actorUserId,
  targetUserId: created.userId,
  granted: false,
  confirmSelf: false,
});
  let lastAdministratorProtected = false;
  try {
  setAdministratorAccess({
    actorUserId,
    targetUserId: actorUserId,
    granted: false,
    confirmSelf: true,
  });
  } catch (error) {
  lastAdministratorProtected = error instanceof AccountManagementError
    && error.code === "last_administrator";
  }

  let selfDisableProtected = false;
  try {
  setAccountEnabled({
    actorUserId,
    targetUserId: actorUserId,
    enabled: false,
    confirmSelf: false,
  });
  } catch (error) {
  selfDisableProtected = error instanceof AccountManagementError
    && error.code === "self_confirmation_required";
  }

  const reset = await resetManagedPassword({
  actorUserId,
  targetUserId: created.userId,
  confirmSelf: false,
});
  const resetCredential = await db.select({ password: accounts.password })
  .from(accounts)
  .where(eq(accounts.userId, created.userId))
  .limit(1);
  const resetPasswordValid = Boolean(
  resetCredential[0]?.password
  && await verifyPassword({
    hash: resetCredential[0].password,
    password: reset.temporaryPassword,
  }),
);

  await db.insert(sessions).values({
  id: "managed-session",
  token: "managed-session-token",
  userId: created.userId,
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
  updatedAt: new Date(),
});
  const revokedSessions = revokeManagedSessions({
  actorUserId,
  targetUserId: created.userId,
});
  setJudgeAccess({
  actorUserId,
  targetUserId: created.userId,
  eventId,
  granted: false,
});
  setAccountEnabled({
  actorUserId,
  targetUserId: created.userId,
  enabled: false,
  confirmSelf: false,
});

  const auditRows = await db.select({
  action: auditEvents.action,
  metadata: auditEvents.metadata,
}).from(auditEvents);
  const serializedAudit = JSON.stringify(auditRows);
  console.log(JSON.stringify({
  createdPasswordValid,
  resetPasswordValid,
  temporaryPasswordsDiffer: created.temporaryPassword !== reset.temporaryPassword,
  lastAdministratorProtected,
  selfDisableProtected,
  revokedSessions: revokedSessions.revoked,
  auditCount: auditRows.length,
  auditContainsPassword: /temporaryPassword|managed-session-token|Vh!8/.test(serializedAudit),
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Account-management smoke failed.");
  process.exitCode = 1;
});
