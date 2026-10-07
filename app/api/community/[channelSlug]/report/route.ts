import { NextRequest, NextResponse } from "next/server";
import { accountMutationOriginFailure, requireAccountPrincipal } from "@/lib/account-api";
import { CommunityChannelError, reportCommunityMessage } from "@/lib/community-channels";
import { getActiveEvent } from "@/lib/events";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ channelSlug: string }> }) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request); if (!authenticated.ok) return authenticated.response;
  const { channelSlug } = await params;
  if (!allowNativeChatAction(`community-report:${authenticated.principal.user.id}`, 5, 60_000)) return NextResponse.json({ error: "Please wait before submitting another report." }, { status: 429 });
  const body = await request.json().catch(() => null) as { messageId?: unknown; category?: unknown; reason?: unknown } | null;
  try {
    const event = await getActiveEvent();
    const result = await reportCommunityMessage({ slug: channelSlug, reporterUserId: authenticated.principal.user.id, eventId: event.id, messageId: typeof body?.messageId === "string" ? body.messageId : "", category: body?.category, reason: body?.reason });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { const status = error instanceof CommunityChannelError && (error.code === "channel_forbidden" || error.code === "participant_required") ? 403 : 422; return NextResponse.json({ error: "Report details could not be submitted." }, { status }); }
}
