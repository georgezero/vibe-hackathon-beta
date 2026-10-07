import { NextRequest, NextResponse } from "next/server";
import { accountMutationOriginFailure, requireAccountPrincipal } from "@/lib/account-api";
import { DirectMessagingError, markDirectConversationRead } from "@/lib/direct-messaging";

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const { conversationId } = await params;
  const body = await request.json().catch(() => null) as { messageId?: unknown } | null;
  try {
    return NextResponse.json(await markDirectConversationRead({ conversationId, userId: authenticated.principal.user.id, messageId: typeof body?.messageId === "string" ? body.messageId : undefined }));
  } catch (error) {
    const status = error instanceof DirectMessagingError && error.code === "conversation_forbidden" ? 403 : 400;
    return NextResponse.json({ error: "You cannot mark this conversation read." }, { status });
  }
}
