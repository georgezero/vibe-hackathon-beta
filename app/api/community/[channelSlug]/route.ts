import { NextRequest, NextResponse } from "next/server";
import { accountMutationOriginFailure, requireAccountPrincipal } from "@/lib/account-api";
import { CommunityChannelError, listCommunityMessages, postCommunityMessage } from "@/lib/community-channels";
import { getActiveEvent } from "@/lib/events";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const code = error instanceof CommunityChannelError ? error.code : "unknown";
  const status: Record<string, number> = { channel_not_found: 404, channel_forbidden: 403, participant_required: 403, channel_archived: 409, posting_not_allowed: 403, invalid_message: 422, invalid_client_message_id: 422, message_conflict: 409 };
  return NextResponse.json({ error: code === "posting_not_allowed" ? "Only organizers can post in this channel." : code === "channel_archived" ? "This channel is archived and read-only." : code === "participant_required" || code === "channel_forbidden" ? "This community channel is not available to this account." : "The community request could not be completed.", code }, { status: status[code] ?? 400, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ channelSlug: string }> }) {
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const { channelSlug } = await params;
  const beforeValue = request.nextUrl.searchParams.get("before");
  const before = beforeValue ? new Date(beforeValue) : undefined;
  if (before && Number.isNaN(before.getTime())) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  try {
    const event = await getActiveEvent();
    return NextResponse.json(await listCommunityMessages({ slug: channelSlug, userId: authenticated.principal.user.id, eventId: event.id, before }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ channelSlug: string }> }) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const { channelSlug } = await params;
  if (!allowNativeChatAction(`community-message:${authenticated.principal.user.id}:${channelSlug}`, 30, 60_000)) return NextResponse.json({ error: "Please wait before sending more messages." }, { status: 429 });
  const body = await request.json().catch(() => null) as { body?: unknown; clientMessageId?: unknown } | null;
  if (!body || typeof body.body !== "string" || typeof body.clientMessageId !== "string") return NextResponse.json({ error: "Message body and client message ID are required." }, { status: 422 });
  try {
    const event = await getActiveEvent();
    const message = await postCommunityMessage({ slug: channelSlug, userId: authenticated.principal.user.id, eventId: event.id, body: body.body, clientMessageId: body.clientMessageId });
    void recordParticipantJourneyEvent({ eventId: event.id, eventType: "participant_community_message_posted", participantUserId: authenticated.principal.user.id, context: "community", destination: "community", outcome: "success" });
    return NextResponse.json({ id: message.id, body: message.body, createdAt: message.createdAt.toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
