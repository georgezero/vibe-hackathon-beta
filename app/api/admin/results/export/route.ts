import { NextRequest, NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/events";
import { getResultsData } from "@/lib/results";
import { withAdminApi } from "@/lib/admin-api";

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function exportResults(request: NextRequest) {
  const event = await getActiveEvent();
  if (!event) return NextResponse.json({ error: "No active event is configured." }, { status: 409 });
  const data = await getResultsData(event.id);
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const rows = data.rows.map((row) => ({
    rank: row.rank ?? "",
    project: row.projectTitle,
    team: row.teamName,
    institution: row.institution,
    completed_reviews: row.completedReviews,
    required_reviews: row.requiredReviews,
    average_score: row.score ?? "",
    median_score: row.median ?? "",
    standard_deviation: row.standardDeviation ?? "",
    high: row.high ?? "",
    low: row.low ?? "",
    tie_status: row.tieStatus,
    finalist: row.finalist,
    winner: row.winner ?? "",
    published: row.published,
    submission_id: row.submissionId,
  }));
  if (format === "csv") {
    const headers = Object.keys(rows[0] ?? { rank: "" });
    const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof typeof row])).join(","))].join("\n");
    return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=results.csv" } });
  }
  return NextResponse.json({ schema: "vibe-results-v1", exportedAt: new Date().toISOString(), event: data.event, summary: data.summary, rows }, { headers: { "Content-Disposition": "attachment; filename=results.json" } });
}

export const GET = withAdminApi("GET /api/admin/results/export", exportResults);
