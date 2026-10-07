import { NextRequest, NextResponse } from "next/server";
import { confirmSubmissionClaim, SUBMISSION_CLAIM_BINDING_COOKIE, SUBMISSION_CLAIM_COOKIE } from "@/lib/submission-claim";
import { getActiveEvent } from "@/lib/events";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

export async function POST(request: NextRequest) {
  const transactionId = request.cookies.get(SUBMISSION_CLAIM_COOKIE)?.value ?? "";
  const browserBinding = request.cookies.get(SUBMISSION_CLAIM_BINDING_COOKIE)?.value ?? "";
  if (!transactionId || !browserBinding) return NextResponse.json({ error: "This claim has expired. Start again." }, { status: 400 });
  const result = await confirmSubmissionClaim({ transactionId, browserBinding, headers: request.headers });
  if (!result.ok) {
    const status = result.reason === "authentication_required" ? 401 : result.reason === "already_claimed" ? 409 : 400;
    return NextResponse.json({ error: result.reason === "already_claimed" ? "This submission is already claimed." : "This claim could not be completed. Start again." }, { status });
  }
  const response = NextResponse.json({ success: true, submissionId: result.submission.id });
  const event = await getActiveEvent();
  void recordParticipantJourneyEvent({ eventId: event.id, eventType: "participant_project_claim_completed", context: "my_projects", destination: "my_projects", outcome: "success" });
  response.cookies.set(SUBMISSION_CLAIM_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 0, expires: new Date(0) });
  response.cookies.set(SUBMISSION_CLAIM_BINDING_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 0, expires: new Date(0) });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
