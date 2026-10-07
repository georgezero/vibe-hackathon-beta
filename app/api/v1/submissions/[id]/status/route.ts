import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions, audienceVotes } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const rows = await db.select({
      id: submissions.id,
      status: submissions.status,
      projectTitle: submissions.projectTitle,
      teamName: submissions.teamName,
      createdAt: submissions.createdAt,
      submittedAt: submissions.submittedAt,
    }).from(submissions).where(eq(submissions.id, id));

    const sub = rows[0];
    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const voteRows = await db.select({ total: count() }).from(audienceVotes).where(eq(audienceVotes.submissionId, id));
    const totalVotes = voteRows[0]?.total ?? 0;

    return NextResponse.json({ ...sub, totalVotes });
  } catch (err) {
    console.error("GET /api/v1/submissions/[id]/status error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
