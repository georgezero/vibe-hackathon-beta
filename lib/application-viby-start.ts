import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { vibyAppSlug, vibyBaseUrl } from "@/lib/viby";
import { VIBY_RUNTIME_CALLBACK_PATH, vibyLoginPolicy } from "@/lib/viby-login-policy";
import { createVibyLoginTransaction, VIBY_BROWSER_BINDING_COOKIE } from "@/lib/viby-login-transactions";
import { logApplicationAudit } from "@/lib/application-audit";

export async function createApplicationVibyStartResponse(
  _request: NextRequest,
  input: {
    returnTo?: string | null;
    freshnessRequired?: boolean;
    redirectStatus?: 303 | 307;
    reason?: "routine" | "fresh_link_step_up" | "account_switch";
  } = {},
) {
  const policy = vibyLoginPolicy("application_login");
  // Generic sign-in is always a deliberate fresh identity-selection request.
  // The policy is server-owned; callers cannot downgrade it with an omitted
  // or false caller option.
  const freshnessRequired = policy.routineFreshnessRequired || input.freshnessRequired === true;
  const baseUrl = getBaseUrl();
  const issued = await createVibyLoginTransaction({
    operation: policy.operation,
    returnTo: input.returnTo,
    expectedAudience: vibyAppSlug(),
    freshnessRequired,
  });
  const callbackUrl = new URL(VIBY_RUNTIME_CALLBACK_PATH, baseUrl);
  callbackUrl.searchParams.set("state", issued.state);
  const startUrl = new URL(`/apps/${vibyAppSlug()}/start`, vibyBaseUrl({ allowDefault: false }));
  startUrl.searchParams.set("mode", policy.runtimeMode);
  startUrl.searchParams.set("callbackUrl", callbackUrl.toString());
  startUrl.searchParams.set("context", JSON.stringify({
    mode: policy.runtimeMode,
    source: policy.source,
    forceIdentityCheck: freshnessRequired,
  }));
  if (freshnessRequired) startUrl.searchParams.set("freshIdentity", "1");

  const response = NextResponse.redirect(startUrl, input.redirectStatus ?? 303);
  response.cookies.set(VIBY_BROWSER_BINDING_COOKIE, issued.browserBinding, {
    httpOnly: true,
    sameSite: "lax",
    secure: baseUrl.startsWith("https://"),
    path: "/",
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  await logApplicationAudit("application_viby_login_started", {
    route: policy.entryPath,
    reason: input.reason ?? "routine",
  });
  return response;
}
