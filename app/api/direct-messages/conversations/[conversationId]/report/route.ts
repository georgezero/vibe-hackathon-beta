import { NextRequest, NextResponse } from "next/server";
import { accountMutationOriginFailure, requireAccountPrincipal } from "@/lib/account-api";
import { DirectMessagingError, reportDirectConversation } from "@/lib/direct-messaging";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request); if (!authenticated.ok) return authenticated.response;
  const { conversationId } = await params;
  if (!allowNativeChatAction(`dm-report:${authenticated.principal.user.id}`, 5, 60_000)) return NextResponse.json({ error: "Please wait before submitting another report." }, { status: 429 });
  const body = await request.json().catch(() => null) as { category?: unknown; reason?: unknown } | null;
  try { const result = await reportDirectConversation({ conversationId, reporterUserId: authenticated.principal.user.id, category: body?.category, reason: body?.reason }); return NextResponse.json(result, { status: 201 }); }
  catch (error) { const status = error instanceof DirectMessagingError && error.code === "conversation_forbidden" ? 403 : 422; return NextResponse.json({ error: "Report details could not be submitted." }, { status }); }
}
