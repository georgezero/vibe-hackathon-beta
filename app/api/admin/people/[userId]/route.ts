import { NextRequest, NextResponse } from "next/server";
import {
  accountMutationOriginFailure,
  requireRecentAccountAdministrator,
} from "@/lib/account-api";
import {
  AccountManagementError,
  resetManagedPassword,
  revokeManagedSessions,
  setAccountEnabled,
  setAdministratorAccess,
  setJudgeAccess,
  updateAccountName,
} from "@/lib/account-management";
import { currentJudgingEventId } from "@/lib/judging-event";
import { withAdminApi } from "@/lib/admin-api";

function operationError(error: unknown) {
  const code = error instanceof AccountManagementError ? error.code : "unknown";
  const messages: Record<string, string> = {
    invalid_name: "Enter a valid name.",
    user_not_found: "This account no longer exists.",
    judge_profile_required: "Choose an explicit judge profile.",
    judge_profile_unavailable: "That judge profile is already assigned.",
    last_administrator: "The last active administrator cannot be removed.",
    self_confirmation_required: "Confirm this change to your own account.",
    authorization_conflict: "The authorization state is ambiguous and was not changed.",
    credential_state_conflict: "The credential state is ambiguous and was not changed.",
  };
  return NextResponse.json({
    error: messages[code] ?? "The account change failed.",
    code,
  }, { status: code.endsWith("conflict") ? 409 : 400 });
}

async function updatePerson(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  if (accountMutationOriginFailure(request)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const eventId = currentJudgingEventId();
  const administrator = await requireRecentAccountAdministrator(request, { eventId });
  if (!administrator.ok) return administrator.response;
  const { userId } = await context.params;
  const body = await request.json().catch(() => null) as {
    operation?: unknown;
    name?: unknown;
    enabled?: unknown;
    granted?: unknown;
    judgeProfileId?: unknown;
    confirmSelf?: unknown;
  } | null;
  if (!body || typeof body.operation !== "string") {
    return NextResponse.json({ error: "Invalid account operation." }, { status: 400 });
  }
  const actorUserId = administrator.principal.user.id;
  try {
    switch (body.operation) {
      case "update_name":
        if (typeof body.name !== "string") throw new AccountManagementError("invalid_name");
        updateAccountName({ actorUserId, targetUserId: userId, name: body.name });
        break;
      case "set_enabled":
        if (typeof body.enabled !== "boolean") {
          return NextResponse.json({ error: "An enabled state is required." }, { status: 400 });
        }
        setAccountEnabled({
          actorUserId,
          targetUserId: userId,
          enabled: body.enabled,
          confirmSelf: body.confirmSelf === true,
        });
        break;
      case "set_admin":
        if (typeof body.granted !== "boolean") {
          return NextResponse.json({ error: "An access state is required." }, { status: 400 });
        }
        setAdministratorAccess({
          actorUserId,
          targetUserId: userId,
          granted: body.granted,
          confirmSelf: body.confirmSelf === true,
        });
        break;
      case "set_judge":
        if (
          typeof body.granted !== "boolean"
          || (
            body.judgeProfileId !== undefined
            && body.judgeProfileId !== null
            && typeof body.judgeProfileId !== "string"
          )
        ) {
          return NextResponse.json({ error: "Invalid judge access request." }, { status: 400 });
        }
        setJudgeAccess({
          actorUserId,
          targetUserId: userId,
          eventId,
          granted: body.granted,
          judgeProfileId: body.judgeProfileId as string | null | undefined,
        });
        break;
      case "revoke_sessions":
        revokeManagedSessions({ actorUserId, targetUserId: userId });
        break;
      default:
        return NextResponse.json({ error: "Unsupported account operation." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return operationError(error);
  }
}

async function resetPersonPassword(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  if (accountMutationOriginFailure(request)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const eventId = currentJudgingEventId();
  const administrator = await requireRecentAccountAdministrator(request, { eventId });
  if (!administrator.ok) return administrator.response;
  const { userId } = await context.params;
  const body = await request.json().catch(() => null) as {
    operation?: unknown;
    confirmSelf?: unknown;
  } | null;
  if (body?.operation !== "reset_password") {
    return NextResponse.json({ error: "Unsupported account operation." }, { status: 400 });
  }
  try {
    const result = await resetManagedPassword({
      actorUserId: administrator.principal.user.id,
      targetUserId: userId,
      confirmSelf: body.confirmSelf === true,
    });
    return NextResponse.json({
      success: true,
      temporaryPassword: result.temporaryPassword,
    }, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    return operationError(error);
  }
}

export const PATCH = withAdminApi(
  "PATCH /api/admin/people/[userId]",
  updatePerson,
);
export const POST = withAdminApi(
  "POST /api/admin/people/[userId]",
  resetPersonPassword,
);
