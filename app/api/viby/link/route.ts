import { NextRequest, NextResponse } from "next/server";
import { createAdminVibyStartResponse } from "@/lib/admin-viby-start";
import { resolveApplicationPrincipal } from "@/lib/application-principal";
import { canonicalizeConfiguredBaseUrl, getBaseUrl } from "@/lib/base-url";
import { strictSameOriginFailure } from "@/lib/same-origin";

export async function POST(request: NextRequest) {
  const origin = canonicalizeConfiguredBaseUrl(getBaseUrl());
  if (strictSameOriginFailure(request, origin)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const principal = await resolveApplicationPrincipal(request.headers);
  if (principal.status !== "authenticated") {
    return NextResponse.redirect(new URL("/admin?reason=session_required", origin), 303);
  }
  if (principal.principal.linkedRuntimeIdentity) {
    return NextResponse.redirect(new URL("/account", origin), 303);
  }

  // Linking deliberately preserves the authenticated account. The pending
  // identity-link transaction performs the existing browser and account lock.
  return createAdminVibyStartResponse(request, {
    returnTo: "/account",
    redirectStatus: 303,
  });
}
