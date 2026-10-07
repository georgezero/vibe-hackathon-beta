import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import {
  acceptInvitationWithPassword,
  ACCOUNT_INVITATION_COOKIE,
  InvitationError,
} from "@/lib/account-invitations";
import { strictSameOriginFailure } from "@/lib/same-origin";

export async function POST(request: NextRequest) {
  if (strictSameOriginFailure(request, new URL(getBaseUrl()).origin)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const token = request.cookies.get(ACCOUNT_INVITATION_COOKIE)?.value ?? "";
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  if (!body || typeof body.password !== "string") {
    return NextResponse.json({ error: "Enter a valid password." }, { status: 400 });
  }
  try {
    await acceptInvitationWithPassword({ token, password: body.password });
    const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store, private" } });
    response.cookies.delete(ACCOUNT_INVITATION_COOKIE);
    return response;
  } catch (error) {
    const code = error instanceof InvitationError ? error.code : "unknown";
    const message = code === "invitation_expired"
      ? "This invitation has expired."
      : code === "invitation_consumed"
        ? "This invitation has already been used."
        : code === "authorization_conflict"
          ? "The requested access is no longer available. Contact an administrator."
          : "The invitation could not be accepted.";
    return NextResponse.json({ error: message, code }, { status: code === "authorization_conflict" ? 409 : 400 });
  }
}
