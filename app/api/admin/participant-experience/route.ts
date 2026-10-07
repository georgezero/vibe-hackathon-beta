import { NextRequest, NextResponse } from "next/server";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";
import { getActiveEvent } from "@/lib/events";
import { getParticipantExperienceData, parseParticipantJourneyWindow } from "@/lib/participant-experience";

async function getParticipantExperience(request: NextRequest, _context: unknown, authorization: AdminApiAuthorization) {
  if (!authorization.session) return NextResponse.json({ error: "A valid organizer session is required." }, { status: 401 });
  const event = await getActiveEvent();
  const window = parseParticipantJourneyWindow(request.nextUrl.searchParams.get("window"));
  const data = await getParticipantExperienceData({ eventId: event.id, window });
  return NextResponse.json({ event: { id: event.id, name: event.displayName || event.name }, data }, {
    headers: { "Cache-Control": "no-store, private" },
  });
}

export const GET = withAdminApi("GET /api/admin/participant-experience", getParticipantExperience);
