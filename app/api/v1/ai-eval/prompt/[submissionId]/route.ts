import { NextRequest, NextResponse } from "next/server";
import { buildJudgePacket, packetToPrompt } from "@/lib/judge-packet";

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

// GET /api/v1/ai-eval/prompt/:submissionId
// Public read-only. Returns the Eval Prompt (markdown) for a submission.
// No tokens exposed. No result submission accepted.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { submissionId } = await params;

  const packet = await buildJudgePacket(submissionId);
  if (!packet) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const prompt = packetToPrompt(packet);

  return new NextResponse(prompt, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="eval-prompt-${submissionId}.md"`,
    },
  });
}
