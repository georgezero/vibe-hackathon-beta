import { NextRequest, NextResponse } from "next/server";
import { requireScopedEvaluationToken } from "@/lib/external-ai-eval";
import { buildJudgePacket } from "@/lib/judge-packet";

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { submissionId } = await params;
  const authorization = await requireScopedEvaluationToken(req, submissionId);
  if (authorization.response) return authorization.response;

  const packet = await buildJudgePacket(submissionId);
  if (!packet) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json(packet, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="agent-eval-${submissionId}.json"`,
    },
  });
}
