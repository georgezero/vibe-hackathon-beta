import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { acceptTeammateInvitation, SubmissionMembershipError } from "@/lib/submission-memberships";
import { INVITATION_COOKIE } from "@/lib/submission-membership-constants";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";
import { getActiveEvent } from "@/lib/events";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!allowNativeChatAction(`invite-accept:${session.user.id}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many invitation attempts. Try again later." }, { status: 429 });
  }
  const token = request.cookies.get(INVITATION_COOKIE)?.value?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "Invitation is invalid or expired." }, { status: 400 });
  try {
    const membership = await acceptTeammateInvitation({ token, userId: session.user.id });
    const event = await getActiveEvent();
    void recordParticipantJourneyEvent({ eventId: event.id, eventType: "participant_invitation_accepted", participantUserId: session.user.id, context: "invitation", destination: "workspace", outcome: "success" });
    const response = NextResponse.json({ success: true, submissionId: membership.submissionId }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(INVITATION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 0, expires: new Date(0) });
    return response;
  } catch (error) {
    const code = error instanceof SubmissionMembershipError ? error.code : "unknown";
    const status = code === "invitation_not_found" || code === "invitation_expired" || code === "invitation_revoked" ? 400 : code === "membership_conflict" || code === "invitation_already_used" ? 409 : 400;
    return NextResponse.json({ error: "This invitation could not be accepted." }, { status });
  }
}
