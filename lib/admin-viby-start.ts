import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { vibyAppSlug, vibyBaseUrl } from "@/lib/viby";
import {
  VIBY_RUNTIME_CALLBACK_PATH,
  vibyLoginPolicy,
} from "@/lib/viby-login-policy";
import {
  createVibyLoginTransaction,
  VIBY_BROWSER_BINDING_COOKIE,
} from "@/lib/viby-login-transactions";

export async function createAdminVibyStartResponse(
  request: NextRequest,
  input: { returnTo?: string | null; redirectStatus?: 303 | 307 } = {},
) {
  const baseUrl = getBaseUrl();
  const policy = vibyLoginPolicy("admin_login");
  const issued = await createVibyLoginTransaction({
    operation: policy.operation,
    returnTo: input.returnTo,
    expectedAudience: vibyAppSlug(),
    freshnessRequired: true,
  });
  const applicationUrl = new URL(VIBY_RUNTIME_CALLBACK_PATH, baseUrl);
  applicationUrl.searchParams.set("state", issued.state);
  const startUrl = new URL(
    `/apps/${vibyAppSlug()}/start`,
    vibyBaseUrl({ allowDefault: false }),
  );
  startUrl.searchParams.set("mode", policy.runtimeMode);
  startUrl.searchParams.set("callbackUrl", applicationUrl.toString());
  startUrl.searchParams.set("context", JSON.stringify({
    mode: policy.runtimeMode,
    source: policy.source,
    forceIdentityCheck: true,
  }));
  startUrl.searchParams.set("freshIdentity", "1");
  const response = NextResponse.redirect(startUrl, input.redirectStatus ?? 303);
  response.cookies.set(VIBY_BROWSER_BINDING_COOKIE, issued.browserBinding, {
    httpOnly: true,
    sameSite: "lax",
    secure: baseUrl.startsWith("https://"),
    path: "/",
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
