import { NextRequest, NextResponse } from "next/server";
import { CommunityChannelError, listCommunityReports } from "@/lib/community-channels";
import { getActiveEvent } from "@/lib/events";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";
import { recentCommunityAdminUserId } from "../auth";

async function getReports(_request: NextRequest, _context: unknown, authorization: AdminApiAuthorization) {
  const userId = recentCommunityAdminUserId(authorization);
  if (!userId) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  try {
    const event = await getActiveEvent();
    const reports = await listCommunityReports(userId, event.id);
    return NextResponse.json({ reports: reports.map((row: typeof reports[number]) => { const { report, channel, message, author } = row; return { id: report.id, channel: channel.slug, channelName: channel.name, messageId: message.id, messageBody: message.removedAt ? "Message removed by an organizer." : message.body, authorName: author.name || "Participant", category: report.category, reason: report.reason, status: report.status, createdAt: report.createdAt.toISOString() }; }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { const status = error instanceof CommunityChannelError && error.code === "admin_required" ? 403 : 400; return NextResponse.json({ error: "Community reports are unavailable." }, { status }); }
}

export const GET = withAdminApi("GET /api/admin/community/reports", getReports);
