import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getCalibrationSubmissionDetail } from "@/lib/calibration";
import CalibrationDetailClient from "./CalibrationDetailClient";

export const dynamic = "force-dynamic";

export default async function CalibrationDetailPage({ params }: { params: Promise<{ submissionId: string }> }) {
  await requireAdminSession();
  const { submissionId } = await params;
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const detail = event ? await getCalibrationSubmissionDetail(event.id, decodeURIComponent(submissionId)) : null;
  if (!detail) notFound();
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="calibration-page"><CalibrationDetailClient detail={detail} /></main></div>;
}
