import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import { logJudgeAudit } from "@/lib/judge-audit";
import { vibyAppSlug, vibyBaseUrl } from "@/lib/viby";
import {
  VIBY_RUNTIME_CALLBACK_PATH,
  vibyLoginPolicy,
} from "@/lib/viby-login-policy";
import {
  createVibyLoginTransaction,
  VIBY_BROWSER_BINDING_COOKIE,
} from "@/lib/viby-login-transactions";

export async function createJudgeVibyStartResponse(
  _request: NextRequest,
  input: {
    freshnessRequired?: true;
    reason: "routine" | "fresh_link_step_up" | "account_switch";
    returnTo?: string | null;
    redirectStatus?: 303 | 307;
  },
) {
  const policy = vibyLoginPolicy("judge_login");
  const freshnessRequired =
    policy.routineFreshnessRequired || input.freshnessRequired === true;
  const baseUrl = getBaseUrl();
  const issued = await createVibyLoginTransaction({
    operation: policy.operation,
    returnTo: input.returnTo,
    expectedAudience: vibyAppSlug(),
    freshnessRequired,
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
    forceIdentityCheck: freshnessRequired,
  }));
  if (freshnessRequired) startUrl.searchParams.set("freshIdentity", "1");

  const response = NextResponse.redirect(
    startUrl,
    input.redirectStatus ?? 307,
  );
  response.cookies.set(VIBY_BROWSER_BINDING_COOKIE, issued.browserBinding, {
    httpOnly: true,
    sameSite: "lax",
    secure: baseUrl.startsWith("https://"),
    path: "/",
    maxAge: 10 * 60,
  });
  response.headers.set("Cache-Control", "no-store");
  await logJudgeAudit("judge_viby_login_started", {
    route: policy.entryPath,
    reason: input.reason,
    authorizationId: issued.transaction.id,
  });
  return response;
}
