import { NextRequest, NextResponse } from "next/server";
import { accountMutationOriginFailure, requireAccountPrincipal } from "@/lib/account-api";
import { CommunityChannelError, markCommunityChannelRead } from "@/lib/community-channels";
import { getActiveEvent } from "@/lib/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ channelSlug: string }> }) {
  if (accountMutationOriginFailure(request)) return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const { channelSlug } = await params;
  const body = await request.json().catch(() => null) as { messageId?: unknown } | null;
  try {
    const event = await getActiveEvent();
    return NextResponse.json(await markCommunityChannelRead({ slug: channelSlug, userId: authenticated.principal.user.id, eventId: event.id, messageId: typeof body?.messageId === "string" ? body.messageId : undefined }));
  } catch (error) { const status = error instanceof CommunityChannelError && (error.code === "channel_forbidden" || error.code === "participant_required") ? 403 : 400; return NextResponse.json({ error: "You cannot mark this channel read." }, { status }); }
}
