import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateRepo } from "@/lib/validate-repo";
import { assertEventNotFrozen } from "@/lib/event-freeze";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const freeze = await assertEventNotFrozen();
    if (freeze.response) return freeze.response;

    const { id } = await params;
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const rows = await db.select().from(submissions).where(eq(submissions.id, id));
    const sub = rows[0];

    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (sub.editToken !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
    }

    const body = await req.json();
    const validation = validateRepo({ ...body, githubUrl: sub.githubUrl });

    const updateData: Record<string, unknown> = {};
    if (body.license) updateData.license = body.license;
    if (body.agentHarnesses) updateData.agentHarnesses = body.agentHarnesses;
    if (body.agentModels) updateData.agentModels = body.agentModels;
    if (body.budgetTier) updateData.budgetTier = body.budgetTier;
    if (body.estimatedHumanHours != null) updateData.estimatedHumanHours = body.estimatedHumanHours;
    if (body.estimatedAgentHours != null) updateData.estimatedAgentHours = body.estimatedAgentHours;
    if (body.vibeJsonRaw) updateData.vibeJsonRaw = typeof body.vibeJsonRaw === "string" ? body.vibeJsonRaw : JSON.stringify(body.vibeJsonRaw);

    if (Object.keys(updateData).length > 0) {
      await db.update(submissions).set(updateData).where(eq(submissions.id, id));
    }

    return NextResponse.json({ success: true, validation });
  } catch (err) {
    console.error("POST /api/v1/submissions/[id]/repo-analysis error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
