import { NextRequest, NextResponse } from "next/server";
import { createCommunityChannel, CommunityChannelError, listCommunityChannels, updateCommunityChannel } from "@/lib/community-channels";
import { getActiveEvent } from "@/lib/events";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";
import { recentCommunityAdminUserId } from "../auth";

async function getChannels(_request: NextRequest, _context: unknown, authorization: AdminApiAuthorization) {
  const userId = recentCommunityAdminUserId(authorization);
  if (!userId) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  if (!allowNativeChatAction(`community-channel-create:${userId}`, 10, 60_000)) return NextResponse.json({ error: "Please wait before creating another channel." }, { status: 429 });
  try { const event = await getActiveEvent(); return NextResponse.json({ event: { id: event.id, name: event.displayName || event.name }, channels: await listCommunityChannels({ userId, eventId: event.id }) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Community channels are unavailable." }, { status: 400 }); }
}

async function createChannel(request: NextRequest, _context: unknown, authorization: AdminApiAuthorization) {
  const userId = recentCommunityAdminUserId(authorization);
  if (!userId) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { slug?: unknown; name?: unknown; description?: unknown; type?: unknown; postingPolicy?: unknown; sortOrder?: unknown } | null;
  try {
    const event = await getActiveEvent();
    const row = await createCommunityChannel({ adminUserId: userId, eventId: event.id, slug: typeof body?.slug === "string" ? body.slug : "", name: typeof body?.name === "string" ? body.name : "", description: typeof body?.description === "string" ? body.description : "", type: body?.type === "announcements" ? "announcements" : "discussion", postingPolicy: body?.postingPolicy === "admins_only" ? "admins_only" : "participants", sortOrder: typeof body?.sortOrder === "number" ? body.sortOrder : 50 });
    return NextResponse.json(row, { status: 201 });
  } catch (error) { const status = error instanceof CommunityChannelError && error.code === "channel_conflict" ? 409 : 422; return NextResponse.json({ error: "The channel could not be created." }, { status }); }
}

async function updateChannel(request: NextRequest, _context: unknown, authorization: AdminApiAuthorization) {
  const userId = recentCommunityAdminUserId(authorization);
  if (!userId) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { channelId?: unknown; name?: unknown; description?: unknown; status?: unknown; sortOrder?: unknown } | null;
  if (typeof body?.channelId !== "string") return NextResponse.json({ error: "Channel ID is required." }, { status: 422 });
  try { const row = await updateCommunityChannel({ channelId: body.channelId, adminUserId: userId, name: typeof body.name === "string" ? body.name : undefined, description: typeof body.description === "string" ? body.description : undefined, status: body.status === "archived" || body.status === "active" ? body.status : undefined, sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined }); return NextResponse.json(row); }
  catch (error) { const status = error instanceof CommunityChannelError && error.code === "channel_not_found" ? 404 : 422; return NextResponse.json({ error: "The channel could not be updated." }, { status }); }
}

export const GET = withAdminApi("GET /api/admin/community/channels", getChannels);
export const POST = withAdminApi("POST /api/admin/community/channels", createChannel);
export const PATCH = withAdminApi("PATCH /api/admin/community/channels", updateChannel);
