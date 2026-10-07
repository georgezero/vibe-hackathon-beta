import { NextRequest, NextResponse } from "next/server";
import { beginSubmissionClaim, claimCookieOptions, SUBMISSION_CLAIM_BINDING_COOKIE, SUBMISSION_CLAIM_COOKIE } from "@/lib/submission-claim";
import { getBaseUrl } from "@/lib/base-url";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { submissionId?: unknown; editToken?: unknown } | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
  const editToken = typeof body?.editToken === "string" ? body.editToken.trim() : "";
  if (!submissionId || !editToken) return NextResponse.json({ error: "We could not verify those submission details." }, { status: 400 });
  const result = await beginSubmissionClaim({ submissionId, editToken, headers: request.headers });
  if (!result.ok) return NextResponse.json({ error: result.reason === "already_claimed" ? "This submission is already claimed." : "We could not verify those submission details." }, { status: 403 });
  const response = NextResponse.json({ next: "/claim/confirm", authenticated: Boolean(result.userId) });
  const options = claimCookieOptions(getBaseUrl().startsWith("https://"));
  response.cookies.set(SUBMISSION_CLAIM_COOKIE, result.transactionId, options);
  response.cookies.set(SUBMISSION_CLAIM_BINDING_COOKIE, result.browserBinding, options);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
