import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { strictSameOriginFailure } from "@/lib/same-origin";
import {
  cancelPendingVibyLink,
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";

export async function POST(request: NextRequest) {
  const origin = new URL(getBaseUrl()).origin;
  if (strictSameOriginFailure(request, origin)) return NextResponse.json({ error: "Origin denied." }, { status: 403 });
  const token = request.cookies.get(VIBY_LINK_TOKEN_COOKIE)?.value ?? "";
  const binding = request.cookies.get(VIBY_LINK_BINDING_COOKIE)?.value ?? "";
  if (token && binding) await cancelPendingVibyLink(token, binding, "admin_login");
  const response = NextResponse.redirect(new URL("/invite/accept?status=cancelled", origin), 303);
  response.cookies.delete(VIBY_LINK_TOKEN_COOKIE);
  response.cookies.delete(VIBY_LINK_BINDING_COOKIE);
  return response;
}
