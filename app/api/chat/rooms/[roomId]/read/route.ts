import { NextRequest, NextResponse } from "next/server";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { ChatError, isNativeChatRoomEnabled, markChatRead } from "@/lib/native-chat";

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await params;
  if (!await isNativeChatRoomEnabled(roomId)) return NextResponse.json({ error: "Messaging is temporarily unavailable." }, { status: 503 });
  const body = await request.json().catch(() => null) as { messageId?: unknown } | null;
  try {
    const state = await markChatRead({ roomId, userId: principal.principal.user.id, messageId: typeof body?.messageId === "string" ? body.messageId : undefined });
    return NextResponse.json({ lastReadMessageId: state.lastReadMessageId, lastReadAt: state.lastReadAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof ChatError && error.code === "read_state_forbidden" ? 403 : error instanceof ChatError && error.code === "message_not_found" ? 404 : 503;
    return NextResponse.json({ error: "Read state could not be updated." }, { status });
  }
}
