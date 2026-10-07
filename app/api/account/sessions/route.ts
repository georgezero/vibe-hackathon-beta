import { NextRequest, NextResponse } from "next/server";
import {
  accountMutationOriginFailure,
  requireAccountPrincipal,
} from "@/lib/account-api";
import {
  AccountManagementError,
  getOwnSessionToken,
} from "@/lib/account-management";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (accountMutationOriginFailure(request)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const authenticated = await requireAccountPrincipal(request);
  if (!authenticated.ok) return authenticated.response;
  const body = await request.json().catch(() => null) as {
    action?: unknown;
    sessionId?: unknown;
  } | null;
  try {
    if (body?.action === "revoke_other") {
      await auth.api.revokeOtherSessions({ headers: request.headers });
      return NextResponse.json({ success: true });
    }
    if (body?.action === "revoke_all") {
      await auth.api.revokeSessions({ headers: request.headers });
      return NextResponse.json({ success: true, signedOut: true });
    }
    if (body?.action === "revoke" && typeof body.sessionId === "string") {
      const token = getOwnSessionToken({
        userId: authenticated.principal.user.id,
        sessionId: body.sessionId,
      });
      if (!token) throw new AccountManagementError("session_not_found");
      await auth.api.revokeSession({
        headers: request.headers,
        body: { token },
      });
      return NextResponse.json({
        success: true,
        signedOut: body.sessionId === authenticated.principal.session.id,
      });
    }
    return NextResponse.json({ error: "Invalid session action." }, { status: 400 });
  } catch (error) {
    const status = error instanceof AccountManagementError
      && error.code === "session_not_found"
      ? 404
      : 400;
    return NextResponse.json({ error: "Session revocation failed." }, { status });
  }
}
