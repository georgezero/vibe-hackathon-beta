import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiJudgeRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAdminApi } from "@/lib/admin-api";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getAiRun(_req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const rows = await db.select().from(aiJudgeRuns).where(eq(aiJudgeRuns.id, id));
  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export const GET = withAdminApi("GET /api/admin/ai-runs/[id]", getAiRun);
