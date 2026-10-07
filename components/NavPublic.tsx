import { Nav } from "./Nav";
import { getActiveEvent, audienceVotingStatus } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import type { AuthenticatedAccountDisplay } from "@/lib/application-account-display";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { currentJudgingEventId } from "@/lib/judging-event";
import { headers } from "next/headers";
import { getDirectUnreadCount } from "@/lib/direct-messaging";
import { canAccessCommunity, getCommunityUnreadCount } from "@/lib/community-channels";
import { db } from "@/lib/db";
import { publicationReleases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { participantNavigationState } from "@/lib/participant-navigation";

export async function NavPublic({
  authenticatedAccount,
  variant = "public",
  workspaceContext = false,
}: {
  authenticatedAccount?: AuthenticatedAccountDisplay | null;
  variant?: "public" | "judge" | "admin";
  workspaceContext?: boolean;
} = {}) {
  const [event, branding] = await Promise.all([
    getActiveEvent(),
    getEventBranding(),
  ]);
  let resolvedAccount = authenticatedAccount;
  let directMessagesUnreadCount = 0;
  let communityUnreadCount = 0;
  let communityAvailable = false;
  if (variant === "public") {
    const requestHeaders = await headers();
    const resolution = await resolveApplicationPrincipal(requestHeaders, {
      eventId: currentJudgingEventId(),
    });
    resolvedAccount = resolution.status === "authenticated"
      ? applicationHeaderAccount({
        display_name: resolution.principal.user.name?.trim()
          || resolution.principal.user.email,
        roles: resolution.principal.roles,
      })
      : null;
    if (resolution.status === "authenticated") {
      directMessagesUnreadCount = await getDirectUnreadCount(resolution.principal.user.id);
      communityAvailable = await canAccessCommunity(resolution.principal.user.id, event.id);
      if (communityAvailable) communityUnreadCount = await getCommunityUnreadCount(resolution.principal.user.id, event.id);
    }
  }
  const release = (await db.select({ status: publicationReleases.status }).from(publicationReleases).where(eq(publicationReleases.eventId, event.id)).limit(1))[0];
  const navigation = participantNavigationState({
    isFrozen: event.isFrozen,
    submissionDeadline: event.submissionDeadline,
    publicationStatus: release?.status,
  });
  const voting = audienceVotingStatus(event);
  const votingStatus = voting.votingMode !== "disabled"
    ? (voting.open ? "open" : "closed") as "open" | "closed"
    : null;
  return (
    <Nav
      variant={variant}
      eventLogoUrl={branding.logoUrl}
      eventName={branding.eventName}
      galleryVotingStatus={votingStatus}
      authenticatedAccount={resolvedAccount}
      directMessagesUnreadCount={directMessagesUnreadCount}
      communityUnreadCount={communityUnreadCount}
      communityAvailable={communityAvailable}
      submissionsOpen={navigation.submissionsOpen}
      resultsPublished={navigation.resultsPublished}
      workspaceContext={workspaceContext}
    />
  );
}
