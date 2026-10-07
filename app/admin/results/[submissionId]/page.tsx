import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getResultDetail } from "@/lib/results";
import ResultDetailClient from "./ResultDetailClient";

export const dynamic = "force-dynamic";

export default async function ResultDetailPage({ params }: { params: Promise<{ submissionId: string }> }) {
  await requireAdminSession();
  const { submissionId } = await params;
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const detail = event ? await getResultDetail(event.id, submissionId) : null;
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="results-page"><ResultDetailClient detail={detail} /></main></div>;
}
