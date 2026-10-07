import { NextRequest, NextResponse } from "next/server";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { revokeTeammateMembership, SubmissionMembershipError } from "@/lib/submission-memberships";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { membershipId } = await params;
  const body = await request.json().catch(() => null) as { submissionId?: unknown; reason?: unknown } | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
  if (!submissionId || !membershipId) return NextResponse.json({ error: "Membership and submission are required" }, { status: 400 });
  try {
    await revokeTeammateMembership({
      submissionId,
      membershipId,
      actorUserId: principal.principal.user.id,
      reason: typeof body?.reason === "string" ? body.reason : undefined,
    });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof SubmissionMembershipError ? error.code : "unknown";
    const status = code === "not_owner" ? 403 : code === "membership_not_found" ? 404 : 409;
    return NextResponse.json({ error: code === "owner_cannot_revoke" ? "The owner membership cannot be revoked." : "The membership change could not be completed." }, { status });
  }
}
