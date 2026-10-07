import { NextRequest, NextResponse } from "next/server";
import { INVITATION_COOKIE } from "@/lib/submission-membership-constants";
import { getBaseUrl } from "@/lib/base-url";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = NextResponse.redirect(new URL("/projects/join", getBaseUrl()), 303);
  response.cookies.set(INVITATION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    // The acceptance POST lives under /api; keep this scoped to the
    // application origin rather than leaking the token into unrelated hosts.
    path: "/",
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
