import { NextRequest, NextResponse } from "next/server";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { revokeTeammateInvitation, SubmissionMembershipError } from "@/lib/submission-memberships";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ invitationId: string }> }) {
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { invitationId } = await params;
  const body = await request.json().catch(() => null) as { submissionId?: unknown } | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
  if (!submissionId || !invitationId) return NextResponse.json({ error: "Invitation and submission are required" }, { status: 400 });
  try {
    await revokeTeammateInvitation({ submissionId, invitationId, actorUserId: principal.principal.user.id });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof SubmissionMembershipError ? error.code : "unknown";
    const status = code === "not_owner" ? 403 : code === "invitation_not_found" ? 404 : code === "invitation_already_used" ? 409 : 400;
    return NextResponse.json({ error: code === "not_owner" ? "Only the submission owner can manage invitations." : "The invitation could not be revoked." }, { status });
  }
}
