import { NextRequest, NextResponse } from "next/server";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import {
  createTeammateInvitation,
  listSubmissionMembershipInvitations,
  listSubmissionMemberships,
  resolveSubmissionOwnerMembership,
  SubmissionMembershipError,
} from "@/lib/submission-memberships";
import { allowNativeChatAction } from "@/lib/native-chat-rate-limit";
import { getBaseUrl } from "@/lib/base-url";
import { getActiveEvent } from "@/lib/events";
import { recordParticipantJourneyEvent } from "@/lib/participant-experience";

function errorResponse(error: unknown) {
  const code = error instanceof SubmissionMembershipError ? error.code : "unknown";
  const status = code === "not_owner" ? 403 : code === "membership_conflict" ? 409 : 400;
  return NextResponse.json({ error: code === "not_owner" ? "Only the submission owner can manage teammates." : "The membership change could not be completed." }, { status });
}

export async function GET(request: NextRequest) {
  const submissionId = request.nextUrl.searchParams.get("submissionId")?.trim() ?? "";
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!submissionId) return NextResponse.json({ error: "Submission ID required" }, { status: 400 });
  if (!allowNativeChatAction(`invite:${principal.principal.user.id}:${submissionId}`, 10, 60 * 60_000)) return NextResponse.json({ error: "Invitation limit reached. Try again later." }, { status: 429 });
  const owner = await resolveSubmissionOwnerMembership({ submissionId, userId: principal.principal.user.id });
  if (owner.status !== "active") return NextResponse.json({ error: "Only the submission owner can manage teammates." }, { status: 403 });
  const rows = await listSubmissionMemberships(submissionId);
  const invitations = await listSubmissionMembershipInvitations(submissionId);
  return NextResponse.json({
    memberships: rows.map((row: typeof rows[number]) => ({
      id: row.membership.id,
      user: { name: row.user.name, email: row.user.email },
      role: row.membership.role,
      status: row.membership.status,
      joinedAt: row.membership.joinedAt?.toISOString() ?? null,
      revokedAt: row.membership.revokedAt?.toISOString() ?? null,
    })),
    invitations: invitations.map((invitation: typeof invitations[number]) => ({
      id: invitation.id,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
      intendedMemberId: invitation.intendedMemberId,
    })),
  });
}

export async function POST(request: NextRequest) {
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { submissionId?: unknown; intendedMemberId?: unknown } | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
  const intendedMemberId = typeof body?.intendedMemberId === "string" ? body.intendedMemberId.trim() : null;
  if (!submissionId) return NextResponse.json({ error: "Submission ID required" }, { status: 400 });
  if (!allowNativeChatAction(`invite-create:${principal.principal.user.id}:${submissionId}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: "Invitation limit reached. Try again later." }, { status: 429 });
  }
  try {
    const invitation = await createTeammateInvitation({
      submissionId,
      ownerUserId: principal.principal.user.id,
      intendedMemberId,
    });
    const event = await getActiveEvent();
    void recordParticipantJourneyEvent({ eventId: event.id, eventType: "participant_invitation_created", participantUserId: principal.principal.user.id, context: "team", destination: "invitation", outcome: "success" });
    return NextResponse.json({
      id: invitation.id,
      inviteUrl: `${getBaseUrl()}/projects/join/${encodeURIComponent(invitation.token)}`,
      expiresAt: invitation.expiresAt.toISOString(),
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
