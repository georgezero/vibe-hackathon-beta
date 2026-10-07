import { headers } from "next/headers";
import { NavPublic } from "@/components/NavPublic";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { getActiveEvent } from "@/lib/events";
import { getParticipantExperienceData, parseParticipantJourneyWindow } from "@/lib/participant-experience";
import { requireAdminSession } from "@/lib/admin-session";
import ParticipantExperienceDashboard from "./ParticipantExperienceDashboard";

export const dynamic = "force-dynamic";

export default async function ParticipantExperiencePage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  await requireAdminSession();
  const resolution = await resolveApplicationPrincipal(await headers());
  if (resolution.status !== "authenticated") return null;
  const event = await getActiveEvent();
  const query = await searchParams;
  const data = await getParticipantExperienceData({ eventId: event.id, window: parseParticipantJourneyWindow(query.window) });
  const account = applicationHeaderAccount({ display_name: resolution.principal.user.name?.trim() || resolution.principal.user.email, roles: resolution.principal.roles });
  return <div className="min-h-screen"><NavPublic variant="admin" authenticatedAccount={account} /><main className="participant-experience-page"><header className="participant-experience-header"><div><p className="participant-experience-kicker">Operations · participant journey</p><h1>Participant Experience</h1><p>Observe where participants move smoothly and where bounded recovery signals deserve a closer look for {event.displayName || event.name}.</p></div><span className="participant-experience-private-badge">Admin only</span></header><ParticipantExperienceDashboard initialData={data} /></main></div>;
}
