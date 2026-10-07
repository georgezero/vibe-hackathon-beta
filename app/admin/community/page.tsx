import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NavPublic } from "@/components/NavPublic";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { getActiveEvent } from "@/lib/events";
import { isRecentAdministratorAuthentication } from "@/lib/account-management";
import { listCommunityChannels, listCommunityReports } from "@/lib/community-channels";
import CommunityAdminClient from "./CommunityAdminClient";
import "../../community/community.css";

export const dynamic = "force-dynamic";

export default async function CommunityAdminPage() {
  const resolution = await resolveApplicationPrincipal(await headers());
  if (resolution.status === "unauthenticated") redirect("/admin?reason=session_required");
  if (resolution.status !== "authenticated" || !resolution.principal.roles.isAdmin) redirect("/admin?reason=not_authorized");
  const event = await getActiveEvent();
  const [channels, reports] = await Promise.all([listCommunityChannels({ userId: resolution.principal.user.id, eventId: event.id }), listCommunityReports(resolution.principal.user.id, event.id)]);
  const account = applicationHeaderAccount({ display_name: resolution.principal.user.name?.trim() || resolution.principal.user.email, roles: resolution.principal.roles });
  return <div className="min-h-screen"><NavPublic variant="admin" authenticatedAccount={account} /><main className="community-shell"><header className="community-heading"><div><h1>Community moderation</h1><p>Manage event channels and review participant reports for {event.displayName || event.name}.</p></div></header><CommunityAdminClient eventName={event.displayName || event.name} recentAuthentication={isRecentAdministratorAuthentication(resolution.principal.session.createdAt)} initialChannels={channels} initialReports={reports.map((row: typeof reports[number]) => ({ id: row.report.id, channel: row.channel.name, channelSlug: row.channel.slug, messageId: row.message.id, messageBody: row.message.removedAt ? "Message removed by an organizer." : row.message.body, authorName: row.author.name || "Participant", category: row.report.category, reason: row.report.reason, status: row.report.status, createdAt: row.report.createdAt.toISOString() }))} /></main></div>;
}
