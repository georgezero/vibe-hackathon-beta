import { NextRequest, NextResponse } from "next/server";
import { buildJudgePacket, packetToPrompt } from "@/lib/judge-packet";
import { withAdminApi } from "@/lib/admin-api";

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

// GET /api/admin/ai-runs/prompt/:submissionId
// Returns a copy/paste prompt for external LLM use (plain text/markdown).
async function getAiRunPrompt(_req: NextRequest, { params }: RouteContext) {
  const { submissionId } = await params;

  const packet = await buildJudgePacket(submissionId);
  if (!packet) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const prompt = packetToPrompt(packet);

  return new NextResponse(prompt, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="prompt_${submissionId}.md"`,
    },
  });
}

export const GET = withAdminApi(
  "GET /api/admin/ai-runs/prompt/[submissionId]",
  getAiRunPrompt,
);
