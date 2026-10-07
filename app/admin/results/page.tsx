import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getResultsData } from "@/lib/results";
import ResultsClient from "./ResultsClient";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  await requireAdminSession();
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const data = event ? await getResultsData(event.id) : null;
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="results-page"><ResultsClient data={data} /></main></div>;
}
