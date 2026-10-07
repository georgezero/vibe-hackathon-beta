import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { getActiveEvent } from "@/lib/events";
import { listCommunityChannels } from "@/lib/community-channels";
import { isCommunityRouteNotFound } from "@/lib/community-route";
import CommunityClient from "./CommunityClient";
import ParticipantJourneyTracker from "@/components/ParticipantJourneyTracker";
import "./community.css";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const principal = await resolveApplicationPrincipal(await headers());
  if (principal.status !== "authenticated") redirect("/login?returnTo=%2Fcommunity");
  const event = await getActiveEvent();
  let channels: Awaited<ReturnType<typeof listCommunityChannels>>;
  try {
    channels = await listCommunityChannels({ userId: principal.principal.user.id, eventId: event.id });
  } catch (error) {
    // Keep non-participants indistinguishable from an unavailable community.
    // The channel route already applies this fail-closed behavior.
    if (isCommunityRouteNotFound(error)) notFound();
    throw error;
  }
  const account = applicationHeaderAccount({ display_name: principal.principal.user.name?.trim() || principal.principal.user.email, roles: principal.principal.roles });
  return <div className="min-h-screen"><ParticipantJourneyTracker eventType="participant_community_opened" context="community" destination="community" /><NavPublic authenticatedAccount={account} /><main className="community-shell"><CommunityClient eventName={event.displayName || event.name} channels={channels} /></main></div>;
}
