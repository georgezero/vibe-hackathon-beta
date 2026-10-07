import { NextRequest, NextResponse } from "next/server";
import { requireAccountPrincipal } from "@/lib/account-api";
import { CommunityChannelError, listCommunityChannels } from "@/lib/community-channels";
import { getActiveEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  try {
    const event = await getActiveEvent();
    return NextResponse.json({ event: { id: event.id, name: event.displayName || event.name, slug: event.slug }, channels: await listCommunityChannels({ userId: authenticated.principal.user.id, eventId: event.id }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof CommunityChannelError && error.code === "participant_required" ? 403 : 400;
    return NextResponse.json({ error: "Community is not available to this account." }, { status });
  }
}
