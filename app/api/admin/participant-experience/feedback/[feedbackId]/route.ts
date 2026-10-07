import { NextRequest, NextResponse } from "next/server";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";
import { getActiveEvent } from "@/lib/events";
import { feedbackStatusIsValid, updateParticipantFeedbackStatus } from "@/lib/participant-experience";

async function updateFeedback(request: NextRequest, context: { params: Promise<{ feedbackId: string }> }, authorization: AdminApiAuthorization) {
  if (!authorization.session) return NextResponse.json({ error: "A valid organizer session is required." }, { status: 401 });
  const { feedbackId } = await context.params;
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (!feedbackId || !body || !feedbackStatusIsValid(body.status)) return NextResponse.json({ error: "Choose a valid feedback state." }, { status: 400 });
  const event = await getActiveEvent();
  const updated = await updateParticipantFeedbackStatus({
    eventId: event.id,
    feedbackId,
    status: body.status,
    reviewerUserId: authorization.session.local_user_id,
  });
  if (!updated) return NextResponse.json({ error: "Feedback item not found for the active event." }, { status: 404 });
  return NextResponse.json({ success: true, id: feedbackId, status: body.status }, { headers: { "Cache-Control": "no-store, private" } });
}

export const PATCH = withAdminApi("PATCH /api/admin/participant-experience/feedback/[feedbackId]", updateFeedback);
