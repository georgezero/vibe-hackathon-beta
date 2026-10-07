import { NextRequest, NextResponse } from "next/server";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { ChatError, listChatMessages, openSubmissionChat, postChatMessage } from "@/lib/native-chat";
import { isNativeTeamChatEnabled, NATIVE_CHAT_UNAVAILABLE_MESSAGE } from "@/lib/native-chat-config";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";
import { getActiveEvent } from "@/lib/events";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

function errorResponse(error: unknown) {
  const code = error instanceof ChatError ? error.code : "unknown";
  const status = code === "membership_required" ? 403 : code === "submission_not_found" || code === "room_not_found" ? 404 : code === "invalid_message" || code === "invalid_client_message_id" ? 422 : code === "message_conflict" ? 409 : 503;
  return NextResponse.json({ error: code === "membership_required" ? "You are not an active team member." : status === 503 ? NATIVE_CHAT_UNAVAILABLE_MESSAGE : "The team room could not be opened." }, { status, headers: { "Cache-Control": "no-store" } });
}

async function principalFor(request: NextRequest) {
  const principal = await resolveApplicationPrincipal(request.headers);
  return principal.status === "authenticated" ? principal.principal.user.id : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  if (!isNativeTeamChatEnabled(submissionId)) return NextResponse.json({ error: NATIVE_CHAT_UNAVAILABLE_MESSAGE }, { status: 503 });
  const userId = await principalFor(request);
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const access = await openSubmissionChat({ submissionId, userId });
    if (access.status !== "active") return errorResponse(new ChatError("membership_required"));
    const beforeValue = request.nextUrl.searchParams.get("before");
    const before = beforeValue ? new Date(beforeValue) : undefined;
    if (before && Number.isNaN(before.getTime())) return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    const result = await listChatMessages({ roomId: access.room.id, userId, before });
    return NextResponse.json({
      room: { id: access.room.id, submissionId: access.room.submissionId, status: access.room.status },
      messages: result.messages.map((row: typeof result.messages[number]) => {
        const message = row.message;
        const author = row.author;
        return {
          id: message.id, type: message.messageType, body: message.body, createdAt: message.createdAt.toISOString(), editedAt: message.editedAt?.toISOString() ?? null, deletedAt: message.deletedAt?.toISOString() ?? null,
          author: author ? { id: author.id, name: author.name || "Team member" } : null,
        };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  if (!isNativeTeamChatEnabled(submissionId)) return NextResponse.json({ error: NATIVE_CHAT_UNAVAILABLE_MESSAGE }, { status: 503 });
  const userId = await principalFor(request);
  if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { body?: unknown; clientMessageId?: unknown } | null;
  if (typeof body?.body !== "string" || typeof body.clientMessageId !== "string") return NextResponse.json({ error: "Message body and client message ID are required." }, { status: 422 });
  if (!allowNativeChatAction(`message:${userId}:${submissionId}`, 30, 60_000)) return NextResponse.json({ error: "Please wait before sending more messages." }, { status: 429 });
  try {
    const access = await openSubmissionChat({ submissionId, userId });
    if (access.status !== "active") return errorResponse(new ChatError("membership_required"));
    const message = await postChatMessage({ roomId: access.room.id, userId, body: body.body, clientMessageId: body.clientMessageId });
    const event = await getActiveEvent();
    void recordParticipantJourneyEvent({ eventId: event.id, eventType: "participant_team_chat_message_posted", participantUserId: userId, context: "team_chat", destination: "team_chat", outcome: "success" });
    return NextResponse.json({ id: message.id, body: message.body, createdAt: message.createdAt.toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
