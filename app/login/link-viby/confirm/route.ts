import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { strictSameOriginFailure } from "@/lib/same-origin";
import { logApplicationAudit } from "@/lib/application-audit";
import { confirmPendingVibyLink, VIBY_LINK_BINDING_COOKIE, VIBY_LINK_TOKEN_COOKIE } from "@/lib/viby-interactive-linking";

export async function POST(req: NextRequest) {
  const origin = new URL(getBaseUrl()).origin;
  if (strictSameOriginFailure(req, origin)) return NextResponse.json({ error: "Origin denied." }, { status: 403 });
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login/link-viby", origin), 303);
  const token = req.cookies.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = req.cookies.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  const result = token && binding ? await confirmPendingVibyLink({
    operation: "application_login",
    token,
    browserBinding: binding,
    userId: session.user.id,
    betterAuthSessionId: session.session.id,
  }) : { ok: false as const, reason: "invalid_transaction" as const };
  if (!result.ok) {
    await logApplicationAudit("application_viby_login_denied", { reason: result.reason, route: "/login/link-viby/confirm" });
    return NextResponse.redirect(new URL(`/login/link-viby?reason=${encodeURIComponent(result.reason)}`, origin), 303);
  }
  await logApplicationAudit("application_viby_link_succeeded", { route: result.returnTo, reason: result.claimType });
  const response = NextResponse.redirect(new URL(result.returnTo, origin), 303);
  response.cookies.delete(VIBY_LINK_TOKEN_COOKIE);
  response.cookies.delete(VIBY_LINK_BINDING_COOKIE);
  return response;
}
