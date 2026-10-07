import { db } from "@/lib/db";
import { accountInvitations, accounts, adminAuthorizations, auditEvents, judgeAuthorizations, users } from "@/lib/db/schema";
import {
  acceptInvitationWithPassword,
  createAccountInvitation,
  inspectAccountInvitation,
  manageInvitation,
} from "@/lib/account-invitations";

async function main() {
const created = createAccountInvitation({
  actorUserId: "operator-user",
  name: "Invited Person",
  email: "invited@example.test",
  grantAdmin: true,
  grantJudge: true,
  judgeProfileId: "judge-profile-1",
  eventId: "event-current",
});
const before = await inspectAccountInvitation(created.token);
const accepted = await acceptInvitationWithPassword({ token: created.token, password: "Correct-Horse-9!Battery" });
const after = await inspectAccountInvitation(created.token);
const second = createAccountInvitation({
  actorUserId: "operator-user",
  name: "Second Person",
  email: "second@example.test",
  grantAdmin: false,
  grantJudge: false,
  eventId: "event-current",
});
const regenerated = manageInvitation({ actorUserId: "operator-user", invitationId: second.invitationId, action: "regenerate" });
const oldToken = await inspectAccountInvitation(second.token);
const newToken = await inspectAccountInvitation(regenerated.token!);

console.log(JSON.stringify({
  beforeStatus: before?.lifecycle,
  acceptedUser: accepted.userId,
  afterStatus: after?.lifecycle,
  credentialCount: (await db.select().from(accounts) as Array<typeof accounts.$inferSelect>).filter((row) => row.userId === created.userId && row.providerId === "credential").length,
  adminCount: (await db.select().from(adminAuthorizations) as Array<typeof adminAuthorizations.$inferSelect>).filter((row) => row.userId === created.userId && row.status === "active").length,
  judgeCount: (await db.select().from(judgeAuthorizations) as Array<typeof judgeAuthorizations.$inferSelect>).filter((row) => row.userId === created.userId && row.status === "active").length,
  oldTokenInvalidated: oldToken === null,
  newTokenStatus: newToken?.lifecycle,
  tokenStored: JSON.stringify(await db.select().from(accountInvitations)).includes(created.token),
  auditContainsSecret: JSON.stringify(await db.select().from(auditEvents)).includes(created.token),
  userCount: (await db.select().from(users)).length,
}));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Invitation smoke failed.");
  process.exitCode = 1;
});
