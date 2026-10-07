import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { strictSameOriginFailure } from "@/lib/same-origin";
import { cancelPendingVibyLink, VIBY_LINK_BINDING_COOKIE, VIBY_LINK_TOKEN_COOKIE } from "@/lib/viby-interactive-linking";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(req: NextRequest) {
  const origin = new URL(getBaseUrl()).origin;
  if (strictSameOriginFailure(req, origin)) return NextResponse.json({ error: "Origin denied." }, { status: 403 });
  const token = req.cookies.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = req.cookies.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  if (token && binding) await cancelPendingVibyLink(token, binding);
  await logAdminAudit("viby_identity_link_cancelled", {});
  const response = NextResponse.redirect(new URL("/admin?reason=link_cancelled", origin), 303);
  response.cookies.delete(VIBY_LINK_TOKEN_COOKIE);
  response.cookies.delete(VIBY_LINK_BINDING_COOKIE);
  return response;
}
