import { NextRequest, NextResponse } from "next/server";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";
import { getActiveEvent } from "@/lib/events";
import { getPublicationData } from "@/lib/publication";

async function exportPublication(request: NextRequest, _context: unknown, _authorization: AdminApiAuthorization) {
  void _context;
  void _authorization;
  const event = await getActiveEvent();
  if (!event) return NextResponse.json({ error: "No active event is configured." }, { status: 409 });
  const data = await getPublicationData(event.id);
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const isPublished = data.release.status === "published" || data.release.status === "archived";
  const publishedRows = isPublished ? data.rows.filter((row) => row.published || row.awards.length > 0) : [];
  const payload = publishedRows.map((row) => ({ submissionId: row.submissionId, project: row.projectTitle, team: row.teamName, institution: row.institution, rank: row.rank, score: row.score, finalist: row.finalist, awards: row.awards.map((award) => award.label), feedbackReleased: row.feedbackStatus === "released" }));
  if (format === "csv") {
    const header = "submission_id,project,team,institution,rank,score,finalist,awards,feedback_released";
    const lines = payload.map((row) => [row.submissionId, row.project, row.team, row.institution, row.rank ?? "", row.score ?? "", row.finalist, row.awards.join("; "), row.feedbackReleased].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
    return new NextResponse([header, ...lines].join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="published-results-${event.id}.csv"` } });
  }
  return NextResponse.json({ event: data.event, release: data.release, results: payload });
}

export const GET = withAdminApi("GET /api/admin/publication/export", exportPublication);
