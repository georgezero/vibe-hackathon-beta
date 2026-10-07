import { Nav } from "@/components/Nav";
import { requireAdminSession } from "@/lib/admin-session";
import { getActiveEvent } from "@/lib/events";
import { getEventBranding } from "@/lib/event-branding";
import { getJudgingCommandCenterData } from "@/lib/judging-command-center";
import JudgingCommandCenterClient from "./JudgingCommandCenterClient";

export const dynamic = "force-dynamic";

export default async function JudgingCommandCenterPage() {
  const [, event, branding] = await Promise.all([requireAdminSession(), getActiveEvent(), getEventBranding()]);
  const data = event ? await getJudgingCommandCenterData(event.id) : { event: null, metrics: { submissions: 0, assigned: 0, requiredEvaluations: 0, fullyEvaluated: 0, notStarted: 0, drafts: 0, submitted: 0, frozen: 0, reopened: 0, missing: 0, activeJudges: 0, judgesWithRemaining: 0, completionPercent: 0, averageMinutes: null }, health: { state: "Healthy" as const, reasons: [] }, judges: [], submissions: [], assignments: [], attention: [], activity: [] };
  return <div className="min-h-screen"><Nav variant="admin" eventName={branding.eventName} eventLogoUrl={branding.logoUrl} /><main className="judging-command-center"><JudgingCommandCenterClient data={data} /></main></div>;
}
