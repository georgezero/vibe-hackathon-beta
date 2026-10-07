import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { requireRecentAccountAdministrator } from "@/lib/account-api";
import { InvitationError, manageInvitation } from "@/lib/account-invitations";
import { currentJudgingEventId } from "@/lib/judging-event";
import { withAdminApi } from "@/lib/admin-api";

async function updateInvitation(
  request: NextRequest,
  context: { params: Promise<{ invitationId: string }> },
) {
  const administrator = await requireRecentAccountAdministrator(request, { eventId: currentJudgingEventId() });
  if (!administrator.ok) return administrator.response;
  const { invitationId } = await context.params;
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  if (!body || !["revoke", "expire", "regenerate"].includes(String(body.action))) {
    return NextResponse.json({ error: "Invalid invitation operation." }, { status: 400 });
  }
  try {
    const result = manageInvitation({
      actorUserId: administrator.principal.user.id,
      invitationId,
      action: body.action as "revoke" | "expire" | "regenerate",
    });
    return NextResponse.json({
      success: true,
      ...(result.token ? { invitationLink: new URL(`/invite/${result.token}`, getBaseUrl()).toString() } : {}),
      expiresAt: result.expiresAt?.toISOString() ?? null,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const code = error instanceof InvitationError ? error.code : "unknown";
    return NextResponse.json({ error: code === "invitation_consumed" ? "This invitation can no longer be changed." : "The invitation could not be changed.", code }, { status: 400 });
  }
}

export const PATCH = withAdminApi("PATCH /api/admin/invitations/[invitationId]", updateInvitation);
