import { NextRequest, NextResponse } from "next/server";
import { buildJudgePacket } from "@/lib/judge-packet";

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

// GET /api/v1/ai-eval/packet/:submissionId
// Public read-only. Returns the Agent Eval JSON for a submission.
// No tokens exposed. No result submission accepted.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { submissionId } = await params;

  const packet = await buildJudgePacket(submissionId);
  if (!packet) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json(packet, {
    headers: {
      "Content-Disposition": `attachment; filename="agent-eval-${submissionId}.json"`,
    },
  });
}
