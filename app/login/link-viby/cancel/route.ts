import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { strictSameOriginFailure } from "@/lib/same-origin";
import { logApplicationAudit } from "@/lib/application-audit";
import { cancelPendingVibyLink, VIBY_LINK_BINDING_COOKIE, VIBY_LINK_TOKEN_COOKIE } from "@/lib/viby-interactive-linking";

export async function POST(req: NextRequest) {
  const origin = new URL(getBaseUrl()).origin;
  if (strictSameOriginFailure(req, origin)) return NextResponse.json({ error: "Origin denied." }, { status: 403 });
  const token = req.cookies.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = req.cookies.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  if (token && binding) await cancelPendingVibyLink(token, binding, "application_login");
  await logApplicationAudit("application_viby_login_denied", { reason: "cancelled", route: "/login/link-viby" });
  const response = NextResponse.redirect(new URL("/login", origin), 303);
  response.cookies.delete(VIBY_LINK_TOKEN_COOKIE);
  response.cookies.delete(VIBY_LINK_BINDING_COOKIE);
  return response;
}
