import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import {
  acceptInvitationAfterViby,
  ACCOUNT_INVITATION_COOKIE,
  inspectAccountInvitation,
} from "@/lib/account-invitations";
import { invitationForLinkTransaction } from "@/lib/account-invitation-viby";
import { strictSameOriginFailure } from "@/lib/same-origin";
import {
  confirmPendingVibyLink,
  preparePendingVibyLink,
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";
import {
  createVibySessionHandoff,
  VIBY_HANDOFF_COOKIE,
} from "@/lib/viby-login-transactions";

export async function POST(request: NextRequest) {
  const origin = new URL(getBaseUrl()).origin;
  if (strictSameOriginFailure(request, origin)) return NextResponse.json({ error: "Origin denied." }, { status: 403 });
  const invitationToken = request.cookies.get(ACCOUNT_INVITATION_COOKIE)?.value ?? "";
  const invitation = await inspectAccountInvitation(invitationToken);
  const token = request.cookies.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = request.cookies.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  if (!invitation || invitation.lifecycle !== "pending" || !token || !binding) {
    return NextResponse.redirect(new URL("/invite/accept?status=invalid", origin), 303);
  }
  const pending = await preparePendingVibyLink({ operation: "admin_login", token, browserBinding: binding, userId: invitation.userId });
  const bridge = pending ? await invitationForLinkTransaction(pending.id) : null;
  if (!pending || !bridge || bridge.invitationId !== invitation.id || bridge.userId !== invitation.userId) {
    return NextResponse.redirect(new URL("/invite/accept?status=invalid", origin), 303);
  }
  const result = await confirmPendingVibyLink({
    operation: "admin_login",
    token,
    browserBinding: binding,
    userId: invitation.userId,
  });
  if (!result.ok) return NextResponse.redirect(new URL("/invite/accept?status=conflict", origin), 303);
  acceptInvitationAfterViby({ token: invitationToken, expectedUserId: invitation.userId });
  const handoff = await createVibySessionHandoff({
    operation: "admin_login",
    transactionId: bridge.loginTransactionId,
    identityLinkId: result.link.id,
    userId: invitation.userId,
    vibySubject: pending.vibySubject,
    returnTo: "/account",
    verificationKind: "fresh",
    verifiedAt: pending.verifiedAt.toISOString(),
  });
  const response = NextResponse.redirect(new URL("/api/auth/viby/complete", origin), 303);
  response.cookies.set(VIBY_HANDOFF_COOKIE, handoff, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https://"), path: "/", maxAge: 60 });
  response.cookies.delete(VIBY_LINK_TOKEN_COOKIE);
  response.cookies.delete(VIBY_LINK_BINDING_COOKIE);
  return response;
}
