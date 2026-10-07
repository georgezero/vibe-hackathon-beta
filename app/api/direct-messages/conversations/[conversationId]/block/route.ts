import { NextRequest, NextResponse } from "next/server";
import { accountMutationOriginFailure, requireAccountPrincipal } from "@/lib/account-api";
import { blockParticipant, DirectMessagingError, resolveDirectConversationAccess, unblockParticipant } from "@/lib/direct-messaging";

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request); if (!authenticated.ok) return authenticated.response;
  const { conversationId } = await params;
  try { const access = await resolveDirectConversationAccess({ conversationId, userId: authenticated.principal.user.id }); await blockParticipant({ blockerUserId: authenticated.principal.user.id, blockedUserId: access.participantUserId }); return NextResponse.json({ ok: true }); }
  catch (error) { const status = error instanceof DirectMessagingError && error.code === "conversation_forbidden" ? 403 : 400; return NextResponse.json({ error: "The conversation could not be blocked." }, { status }); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request); if (!authenticated.ok) return authenticated.response;
  const { conversationId } = await params;
  try { const access = await resolveDirectConversationAccess({ conversationId, userId: authenticated.principal.user.id }); await unblockParticipant({ blockerUserId: authenticated.principal.user.id, blockedUserId: access.participantUserId }); return NextResponse.json({ ok: true }); }
  catch (error) { const status = error instanceof DirectMessagingError && error.code === "conversation_forbidden" ? 403 : 400; return NextResponse.json({ error: "The conversation could not be unblocked." }, { status }); }
}
