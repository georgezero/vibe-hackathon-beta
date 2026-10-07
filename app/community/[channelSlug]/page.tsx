import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { getActiveEvent } from "@/lib/events";
import { listCommunityChannels, listCommunityMessages } from "@/lib/community-channels";
import { isCommunityRouteNotFound } from "@/lib/community-route";
import CommunityClient from "../CommunityClient";
import ParticipantJourneyTracker from "@/components/ParticipantJourneyTracker";
import "../community.css";

export const dynamic = "force-dynamic";

export default async function CommunityChannelPage({ params }: { params: Promise<{ channelSlug: string }> }) {
  const principal = await resolveApplicationPrincipal(await headers());
  if (principal.status !== "authenticated") redirect(`/login?returnTo=${encodeURIComponent("/community")}`);
  const { channelSlug } = await params;
  const event = await getActiveEvent();
  let channels: Awaited<ReturnType<typeof listCommunityChannels>>;
  let history: Awaited<ReturnType<typeof listCommunityMessages>>;
  try {
    [channels, history] = await Promise.all([listCommunityChannels({ userId: principal.principal.user.id, eventId: event.id }), listCommunityMessages({ slug: channelSlug, userId: principal.principal.user.id, eventId: event.id })]);
  } catch (error) { if (isCommunityRouteNotFound(error)) notFound(); throw error; }
  const channel = channels.find((row) => row.slug === channelSlug.toLowerCase());
  if (!channel) notFound();
  const account = applicationHeaderAccount({ display_name: principal.principal.user.name?.trim() || principal.principal.user.email, roles: principal.principal.roles });
  return <div className="min-h-screen"><ParticipantJourneyTracker eventType="participant_community_channel_opened" context="community" destination="community" /><NavPublic authenticatedAccount={account} /><main className="community-shell"><CommunityClient eventName={event.displayName || event.name} channels={channels} selectedSlug={channel.slug} initialChannel={channel} initialMessages={history.messages} initialHasMore={history.hasMore} /></main></div>;
}
