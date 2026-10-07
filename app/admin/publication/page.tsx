import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getPublicationData } from "@/lib/publication";
import PublicationClient from "./PublicationClient";

export const dynamic = "force-dynamic";

export default async function PublicationPage() {
  await requireAdminSession();
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const data = event ? await getPublicationData(event.id) : null;
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="publication-page"><PublicationClient data={data} /></main></div>;
}
