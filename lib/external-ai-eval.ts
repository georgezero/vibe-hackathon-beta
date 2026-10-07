import { NextRequest, NextResponse } from "next/server";
import { validateEvalToken } from "./judge-packet";

export function externalAiEvalUrls(baseUrl: string, submissionId: string) {
  const encodedId = encodeURIComponent(submissionId);
  const root = `${baseUrl}/api/v1/ai-eval/external`;
  return {
    packetUrl: `${root}/packet/${encodedId}`,
    promptUrl: `${root}/prompt/${encodedId}`,
    importUrl: `${root}/import/${encodedId}`,
  };
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export function externalAiEvalPromptCurl(input: {
  promptUrl: string;
  submissionId: string;
  token: string;
}) {
  const filename = `eval-prompt-${input.submissionId.replaceAll(/[^a-zA-Z0-9_-]/g, "_")}.md`;
  return [
    "curl --fail --silent --show-error",
    `  -H ${shellQuote(`Authorization: Bearer ${input.token}`)}`,
    `  ${shellQuote(input.promptUrl)}`,
    `  -o ${shellQuote(filename)}`,
  ].join(" \\\n");
}

export function evaluationBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match?.[1] ?? null;
}

export async function requireScopedEvaluationToken(
  request: NextRequest,
  submissionId: string,
): Promise<
  | { token: null; response: NextResponse }
  | { token: string; response: null }
> {
  const token = evaluationBearerToken(request);
  if (!token) {
    return {
      token: null,
      response: NextResponse.json(
        { error: "A scoped evaluation token is required." },
        { status: 401 },
      ),
    };
  }

  if (!await validateEvalToken(submissionId, token)) {
    return {
      token: null,
      response: NextResponse.json(
        { error: "The evaluation token is invalid or expired." },
        { status: 403 },
      ),
    };
  }

  return { token, response: null };
}
