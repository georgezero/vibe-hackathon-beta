import { NextRequest, NextResponse } from "next/server";
import { buildJudgePacket } from "@/lib/judge-packet";
import { withAdminApi } from "@/lib/admin-api";

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

// GET /api/admin/ai-runs/packet/:submissionId
// Returns a complete judge packet for external LLM evaluation.
// Never includes edit tokens, admin tokens, judge tokens, or API keys.
async function getAiRunPacket(_req: NextRequest, { params }: RouteContext) {
  const { submissionId } = await params;

  const packet = await buildJudgePacket(submissionId);
  if (!packet) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json(packet, {
    headers: {
      "Content-Disposition": `attachment; filename="packet_${submissionId}.json"`,
    },
  });
}

export const GET = withAdminApi(
  "GET /api/admin/ai-runs/packet/[submissionId]",
  getAiRunPacket,
);
