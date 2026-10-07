import { NextRequest, NextResponse } from "next/server";
import { CommunityChannelError, setCommunityMessageRemoved } from "@/lib/community-channels";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";
import { recentCommunityAdminUserId } from "../../auth";

async function removeMessage(request: NextRequest, { params }: { params: Promise<{ messageId: string }> }, authorization: AdminApiAuthorization) {
  const userId = recentCommunityAdminUserId(authorization);
  if (!userId) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { messageId } = await params;
  const body = await request.json().catch(() => null) as { removed?: unknown } | null;
  try { return NextResponse.json(await setCommunityMessageRemoved({ messageId, adminUserId: userId, removed: body?.removed !== false })); }
  catch (error) { const status = error instanceof CommunityChannelError && error.code === "message_not_found" ? 404 : 403; return NextResponse.json({ error: "The moderation action could not be completed." }, { status }); }
}

export const POST = withAdminApi("POST /api/admin/community/messages/[messageId]", removeMessage);
