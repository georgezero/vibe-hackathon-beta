import { NextRequest, NextResponse } from "next/server";
import { accountMutationOriginFailure, requireAccountPrincipal } from "@/lib/account-api";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";
import { DirectMessagingError, findOrCreateDirectConversation, listDirectConversations } from "@/lib/direct-messaging";
import { getActiveEvent } from "@/lib/events";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

function errorResponse(error: unknown) {
  const code = error instanceof DirectMessagingError ? error.code : "unknown";
  const statuses: Record<string, number> = {
    participant_required: 403, recipient_not_available: 404, self_message: 400,
  message_blocked: 403, messaging_disabled: 403, recipient_unavailable: 403, rate_limited: 429,
  };
  return NextResponse.json({ error: code === "recipient_not_available" ? "This participant is not available for new messages." : code === "message_blocked" || code === "messaging_disabled" ? "Messages are unavailable for this participant." : "The conversation could not be opened.", code }, { status: statuses[code] ?? 400, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  try {
    return NextResponse.json({ conversations: await listDirectConversations(authenticated.principal.user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  if (!allowNativeChatAction(`dm-start:${authenticated.principal.user.id}`, 10, 60_000)) return NextResponse.json({ error: "Please wait before starting another conversation." }, { status: 429 });
  const body = await request.json().catch(() => null) as { handle?: unknown } | null;
  if (typeof body?.handle !== "string") return NextResponse.json({ error: "A participant handle is required." }, { status: 422 });
  try {
    const id = await findOrCreateDirectConversation({ senderUserId: authenticated.principal.user.id, recipientHandle: body.handle });
    void getActiveEvent().then((event) => recordParticipantJourneyEvent({ eventId: event.id, eventType: "participant_dm_created", participantUserId: authenticated.principal.user.id, context: "messages", destination: "messages", outcome: "success" })).catch(() => undefined);
    return NextResponse.json({ conversationId: id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
