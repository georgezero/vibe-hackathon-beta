import { NextRequest } from "next/server";
import { importAiEvaluation } from "@/lib/ai-evaluation-import";
import { requireScopedEvaluationToken } from "@/lib/external-ai-eval";
import { markEvalTokenUsed } from "@/lib/judge-packet";

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { submissionId } = await params;
  const authorization = await requireScopedEvaluationToken(req, submissionId);
  if (authorization.response) return authorization.response;

  const response = await importAiEvaluation(req, {
    requiredSubmissionId: submissionId,
  });
  if (response.ok) {
    await markEvalTokenUsed(authorization.token);
  }
  return response;
}
