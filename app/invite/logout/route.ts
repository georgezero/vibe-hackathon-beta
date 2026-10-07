import { NextRequest, NextResponse } from "next/server";
import { ACCOUNT_INVITATION_COOKIE } from "@/lib/account-invitations";
import { applyApplicationLogout } from "@/lib/application-logout";
import { getBaseUrl } from "@/lib/base-url";
import { strictSameOriginFailure } from "@/lib/same-origin";

export async function POST(request: NextRequest) {
  const origin = new URL(getBaseUrl()).origin;
  if (strictSameOriginFailure(request, origin)) return NextResponse.json({ error: "Origin denied." }, { status: 403 });
  const response = NextResponse.redirect(new URL("/invite/accept", origin), 303);
  await applyApplicationLogout(request, response, {
    preserve: [ACCOUNT_INVITATION_COOKIE],
  });
  return response;
}
