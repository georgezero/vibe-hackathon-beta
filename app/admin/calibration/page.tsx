import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getCalibrationData } from "@/lib/calibration";
import CalibrationClient from "./CalibrationClient";

export const dynamic = "force-dynamic";

export default async function CalibrationPage() {
  await requireAdminSession();
  const [event, branding] = await Promise.all([getActiveEvent(), getEventBranding()]);
  const data = event ? await getCalibrationData(event.id) : null;
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="calibration-page"><CalibrationClient data={data} /></main></div>;
}
