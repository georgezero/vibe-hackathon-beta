import { NextRequest, NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import {
  PARTICIPANT_CONTEXTS,
  createParticipantFeedback,
  feedbackCategoryIsValid,
  feedbackMessageIsValid,
} from "@/lib/participant-experience";

export async function POST(request: NextRequest) {
  const event = await getActiveEvent();
  const resolution = await resolveApplicationPrincipal(request.headers, { eventId: event.id });
  if (resolution.status !== "authenticated") return NextResponse.json({ error: "Sign in is required to send feedback." }, { status: 401 });
  const body = await request.json().catch(() => null) as { category?: unknown; context?: unknown; message?: unknown } | null;
  if (!body || !feedbackCategoryIsValid(body.category) || typeof body.context !== "string" || !PARTICIPANT_CONTEXTS.includes(body.context as typeof PARTICIPANT_CONTEXTS[number]) || !feedbackMessageIsValid(body.message)) {
    return NextResponse.json({ error: "Choose a category and add a short note (up to 1,000 characters)." }, { status: 400 });
  }
  const result = await createParticipantFeedback({
    eventId: event.id,
    participantUserId: resolution.principal.user.id,
    category: body.category,
    context: body.context as typeof PARTICIPANT_CONTEXTS[number],
    message: body.message,
  });
  if (result === "rate_limited") return NextResponse.json({ error: "Feedback is limited to three notes per hour. Try again later." }, { status: 429 });
  if (!result) return NextResponse.json({ error: "Feedback could not be saved." }, { status: 503 });
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store, private" } });
}
