import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getResultsData, getResultDetail } from "@/lib/results";
import TieReviewClient from "./TieReviewClient";

export const dynamic = "force-dynamic";

export default async function TieReviewPage({ params }: { params: Promise<{ tieKey: string }> }) {
  await requireAdminSession();
  const { tieKey } = await params;
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const results = event ? await getResultsData(event.id) : null;
  const tie = results?.ties.find((item) => item.tieKey === tieKey) ?? null;
  const details = tie && event ? (await Promise.all(tie.submissionIds.map((id) => getResultDetail(event.id, id)))).filter((detail): detail is NonNullable<typeof detail> => Boolean(detail)) : [];
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="results-page"><TieReviewClient tie={tie} details={details} /></main></div>;
}
