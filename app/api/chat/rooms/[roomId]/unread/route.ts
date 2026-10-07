import { NextRequest, NextResponse } from "next/server";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { ChatError, getChatUnreadCount, isNativeChatRoomEnabled } from "@/lib/native-chat";

export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { roomId } = await params;
  if (!await isNativeChatRoomEnabled(roomId)) return NextResponse.json({ error: "Messaging is temporarily unavailable." }, { status: 503 });
  try {
    return NextResponse.json({ count: await getChatUnreadCount({ roomId, userId: principal.principal.user.id }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof ChatError && error.code === "membership_required" ? 403 : 503;
    return NextResponse.json({ error: "Unread state is unavailable." }, { status });
  }
}
