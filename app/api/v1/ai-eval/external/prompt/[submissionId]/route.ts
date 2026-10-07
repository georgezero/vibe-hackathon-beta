import { NextRequest, NextResponse } from "next/server";
import { requireScopedEvaluationToken } from "@/lib/external-ai-eval";
import { buildJudgePacket, packetToPrompt } from "@/lib/judge-packet";

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

  return new NextResponse(packetToPrompt(packet), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="eval-prompt-${submissionId}.md"`,
    },
  });
}
