export const dynamic = "force-dynamic";

import { NavPublic } from "@/components/NavPublic";
import { getEventBranding } from "@/lib/event-branding";
import InstructionsClient from "./InstructionsClient";

export default async function SubmitInstructionsPage() {
  const branding = await getEventBranding();
  return (
    <div className="flex flex-col min-h-screen">
      <NavPublic />
      <InstructionsClient />
    </div>
  );
}
