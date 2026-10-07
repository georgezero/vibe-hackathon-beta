import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import {
  ACCOUNT_INVITATION_COOKIE,
  inspectAccountInvitation,
} from "@/lib/account-invitations";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const invitation = await inspectAccountInvitation(token);
  const destination = invitation
    ? "/invite/accept"
    : "/invite/accept?status=invalid";
  const response = NextResponse.redirect(new URL(destination, getBaseUrl()));
  response.headers.set("Cache-Control", "no-store, private");
  if (invitation) {
    response.cookies.set(ACCOUNT_INVITATION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: getBaseUrl().startsWith("https://"),
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return response;
}
