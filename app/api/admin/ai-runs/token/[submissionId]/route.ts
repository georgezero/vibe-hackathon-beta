import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateEvalToken } from "@/lib/judge-packet";
import { getBaseUrl } from "@/lib/base-url";
import { withAdminApi } from "@/lib/admin-api";
import {
  externalAiEvalPromptCurl,
  externalAiEvalUrls,
} from "@/lib/external-ai-eval";

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

// POST /api/admin/ai-runs/token/:submissionId
// Lightweight: returns (or creates) an evaluation token without fetching GitHub.
// Use this to build Copy Curl commands without incurring a GitHub fetch.
async function createAiRunToken(_req: NextRequest, { params }: RouteContext) {
  const { submissionId } = await params;

  const subRows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.id, submissionId));

  if (!subRows[0]) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const token = await getOrCreateEvalToken(submissionId);
  const baseUrl = getBaseUrl();
  const urls = externalAiEvalUrls(baseUrl, submissionId);

  return NextResponse.json({
    submissionId,
    token,
    ...urls,
    authorizationScheme: "Bearer",
    curlCommand: externalAiEvalPromptCurl({
      promptUrl: urls.promptUrl,
      submissionId,
      token,
    }),
  });
}

export const POST = withAdminApi(
  "POST /api/admin/ai-runs/token/[submissionId]",
  createAiRunToken,
);
