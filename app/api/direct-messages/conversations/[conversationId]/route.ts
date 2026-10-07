import { NextRequest, NextResponse } from "next/server";
import { accountMutationOriginFailure, requireAccountPrincipal } from "@/lib/account-api";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";
import { DirectMessagingError, listDirectMessages, postDirectMessage } from "@/lib/direct-messaging";

function errorResponse(error: unknown) {
  const code = error instanceof DirectMessagingError ? error.code : "unknown";
  const status = code === "conversation_forbidden" ? 403 : code === "conversation_not_found" ? 404 : code === "message_blocked" || code === "messaging_disabled" || code === "recipient_unavailable" ? 403 : code === "invalid_message" || code === "invalid_client_message_id" ? 422 : code === "message_conflict" ? 409 : 400;
  return NextResponse.json({ error: code === "conversation_forbidden" ? "You cannot access this conversation." : code === "message_blocked" || code === "messaging_disabled" || code === "recipient_unavailable" ? "You cannot send messages in this conversation." : "The conversation request could not be completed.", code }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const { conversationId } = await params;
  const beforeValue = request.nextUrl.searchParams.get("before");
  const before = beforeValue ? new Date(beforeValue) : undefined;
  if (before && Number.isNaN(before.getTime())) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });
  try {
    const result = await listDirectMessages({ conversationId, userId: authenticated.principal.user.id, before });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const { conversationId } = await params;
  if (!allowNativeChatAction(`dm-message:${authenticated.principal.user.id}:${conversationId}`, 30, 60_000)) return NextResponse.json({ error: "Please wait before sending more messages." }, { status: 429 });
  const body = await request.json().catch(() => null) as { body?: unknown; clientMessageId?: unknown } | null;
  if (!body || typeof body.body !== "string" || typeof body.clientMessageId !== "string") return NextResponse.json({ error: "Message body and client message ID are required." }, { status: 422 });
  try {
    const message = await postDirectMessage({ conversationId, userId: authenticated.principal.user.id, body: body.body, clientMessageId: body.clientMessageId });
    return NextResponse.json({ id: message.id, body: message.body, createdAt: message.createdAt.toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
