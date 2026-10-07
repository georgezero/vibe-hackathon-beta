import { NextRequest, NextResponse } from "next/server";
import {
  accountMutationOriginFailure,
  requireRecentAccountAdministrator,
} from "@/lib/account-api";
import {
  AccountManagementError,
  createManagedAccount,
} from "@/lib/account-management";
import { createAccountInvitation, InvitationError } from "@/lib/account-invitations";
import { getBaseUrl } from "@/lib/base-url";
import { currentJudgingEventId } from "@/lib/judging-event";
import { withAdminApi } from "@/lib/admin-api";

function errorResponse(error: unknown) {
  const code = error instanceof AccountManagementError || error instanceof InvitationError ? error.code : "unknown";
  const messages: Record<string, string> = {
    invalid_name: "Enter a valid name.",
    invalid_email: "Enter a valid email address.",
    email_conflict: "An account already uses this email address.",
    judge_profile_required: "Choose an explicit judge profile.",
    judge_profile_unavailable: "That judge profile is already assigned.",
    event_not_found: "The current judging event is unavailable.",
  };
  return NextResponse.json({
    error: messages[code] ?? "The account could not be created.",
    code,
  }, { status: code === "email_conflict" ? 409 : 400 });
}

async function createPerson(request: NextRequest) {
  if (accountMutationOriginFailure(request)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const eventId = currentJudgingEventId();
  const administrator = await requireRecentAccountAdministrator(request, { eventId });
  if (!administrator.ok) return administrator.response;
  const body = await request.json().catch(() => null) as {
    name?: unknown;
    email?: unknown;
    grantAdmin?: unknown;
    grantJudge?: unknown;
    judgeProfileId?: unknown;
    provisionMode?: unknown;
  } | null;
  if (
    !body
    || typeof body.name !== "string"
    || typeof body.email !== "string"
    || typeof body.grantAdmin !== "boolean"
    || typeof body.grantJudge !== "boolean"
    || (body.provisionMode !== undefined && body.provisionMode !== "invitation" && body.provisionMode !== "temporary_password")
    || (
      body.judgeProfileId !== undefined
      && body.judgeProfileId !== null
      && typeof body.judgeProfileId !== "string"
    )
  ) {
    return NextResponse.json({ error: "Invalid account request." }, { status: 400 });
  }
  try {
    if (body.provisionMode !== "temporary_password") {
      const result = createAccountInvitation({
        actorUserId: administrator.principal.user.id,
        name: body.name,
        email: body.email,
        grantAdmin: body.grantAdmin,
        grantJudge: body.grantJudge,
        judgeProfileId: body.judgeProfileId as string | null | undefined,
        eventId,
      });
      return NextResponse.json({
        success: true,
        userId: result.userId,
        invitationId: result.invitationId,
        invitationLink: new URL(`/invite/${result.token}`, getBaseUrl()).toString(),
        expiresAt: result.expiresAt.toISOString(),
      }, { status: 201, headers: { "Cache-Control": "no-store, private" } });
    }
    const result = await createManagedAccount({
      actorUserId: administrator.principal.user.id,
      name: body.name,
      email: body.email,
      grantAdmin: body.grantAdmin,
      grantJudge: body.grantJudge,
      judgeProfileId: body.judgeProfileId as string | null | undefined,
      eventId,
    });
    return NextResponse.json({
      success: true,
      userId: result.userId,
      temporaryPassword: result.temporaryPassword,
    }, {
      status: 201,
      headers: {
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const POST = withAdminApi("POST /api/admin/people", createPerson);
