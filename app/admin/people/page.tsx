export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { listPeopleAndAccess } from "@/lib/account-directory";
import { isRecentAdministratorAuthentication } from "@/lib/account-management";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { currentJudgingEventId } from "@/lib/judging-event";
import { getJudgingEvent } from "@/lib/judging-event";
import PeopleAccessClient from "./PeopleAccessClient";
import "./people.css";

export default async function PeopleAccessPage() {
  const eventId = currentJudgingEventId();
  const requestHeaders = await headers();
  const principalResolution = await resolveApplicationPrincipal(requestHeaders, { eventId });
  if (principalResolution.status === "unauthenticated") {
    redirect("/admin?reason=session_required");
  }
  if (
    principalResolution.status !== "authenticated"
    || !principalResolution.principal.roles.isAdmin
  ) {
    redirect("/admin?reason=not_authorized");
  }
  if (principalResolution.principal.account.passwordChangeRequired) {
    redirect("/account?password=required");
  }
  const [directory, event] = await Promise.all([
    listPeopleAndAccess(eventId),
    getJudgingEvent(eventId),
  ]);
  const principal = principalResolution.principal;
  const account = applicationHeaderAccount({
    display_name: principal.user.name?.trim() || principal.user.email,
    roles: principal.roles,
  });
  return (
    <div className="min-h-screen">
      <NavPublic variant="admin" authenticatedAccount={account} />
      <PeopleAccessClient
        currentUserId={principal.user.id}
        recentAuthentication={isRecentAdministratorAuthentication(principal.session.createdAt)}
        eventName={event?.name ?? "current event"}
        initialPeople={directory.people.map((person) => ({
          ...person,
          createdAt: person.createdAt.toISOString(),
          lastSignInAt: person.lastSignInAt?.toISOString() ?? null,
          passwordChangedAt: person.passwordChangedAt?.toISOString() ?? null,
          invitation: person.invitation ? {
            ...person.invitation,
            expiresAt: person.invitation.expiresAt.toISOString(),
            createdAt: person.invitation.createdAt.toISOString(),
          } : null,
          recentAudit: person.recentAudit.map((event) => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
          })),
        }))}
        judgeProfiles={directory.judgeProfiles}
      />
    </div>
  );
}
