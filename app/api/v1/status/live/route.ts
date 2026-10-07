export const dynamic = "force-dynamic";

// Public endpoint — no auth required. Never returns emails, badge numbers,
// edit tokens, or private owner identities.

import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events";
import { deriveEventStage, getStatusPageData } from "@/lib/event-status";

export async function GET() {
  try {
    const event = await getActiveEvent();
    const data = await getStatusPageData(event);
    const stage = deriveEventStage(event, data.winnersPublished ? "published" : null);

    return NextResponse.json({
      generatedAt: data.updatedAt.toISOString(),
      stage,
      metrics: data.metrics,
      institutions: data.institutions,
      maxInstitutionTeams: data.maxInstitutionTeams,
      audienceLeaderboard: data.audienceLeaderboard,
      aiLeaderboard: data.aiLeaderboard,
      officialLeaderboard: data.officialLeaderboard,
      breakdown: data.breakdown,
      recentActivity: data.recentActivity.map((a) => ({
        key: a.key,
        icon: a.icon,
        label: a.label,
        detail: a.detail,
        timestamp: a.timestamp.toISOString(),
      })),
      votingOpen: data.votingOpen,
      resultsVisible: data.resultsVisible,
      submissionsOpen: data.submissionsOpen,
      winnersPublished: data.winnersPublished,
    });
  } catch (err) {
    console.error("/api/v1/status/live error:", err);
    return NextResponse.json({ error: "Failed to generate status" }, { status: 500 });
  }
}
