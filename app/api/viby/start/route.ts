import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/base-url";
import {
  issueVibyCallbackState,
  setVibyCallbackStateCookie,
  VIBY_CALLBACK_STATE_COOKIE,
  type VibyCallbackFlow,
} from "@/lib/viby-callback-state";
import { vibyAppSlug, vibyBaseUrl } from "@/lib/viby";
import { vibyAdminSessionMode } from "@/lib/viby";
import { createAdminVibyStartResponse } from "@/lib/admin-viby-start";
import { createJudgeVibyStartResponse } from "@/lib/judge-viby-start";
import { createApplicationVibyStartResponse } from "@/lib/application-viby-start";
import { beginFreshVibySignIn } from "@/lib/fresh-viby-sign-in";
import { canonicalizeConfiguredBaseUrl } from "@/lib/base-url";
import { strictSameOriginFailure } from "@/lib/same-origin";
import {
  VIBY_RUNTIME_CALLBACK_PATH,
  VIBY_RUNTIME_MODE,
  VIBY_RUNTIME_SOURCE,
} from "@/lib/viby-login-policy";

const flows = {
  application: {
    callbackPath: VIBY_RUNTIME_CALLBACK_PATH,
    source: VIBY_RUNTIME_SOURCE,
    mode: VIBY_RUNTIME_MODE,
  },
  admin: {
    callbackPath: VIBY_RUNTIME_CALLBACK_PATH,
    source: VIBY_RUNTIME_SOURCE,
    mode: VIBY_RUNTIME_MODE,
  },
  agent: { callbackPath: "/admin/viby/agent-callback", source: "vibe_agent_attribution_demo", mode: "agent-attribution" },
  artifact: { callbackPath: "/admin/viby/artifact-callback", source: "vibe_verified_artifact", mode: "agent-attribution" },
  judge: {
    callbackPath: VIBY_RUNTIME_CALLBACK_PATH,
    source: VIBY_RUNTIME_SOURCE,
    mode: VIBY_RUNTIME_MODE,
  },
} as const;

function errorResponse() {
  return NextResponse.json({ error: "Invalid Viby login flow." }, { status: 400 });
}

function createLegacyAdminVibyStartResponse() {
  const baseUrl = getBaseUrl();
  const config = flows.admin;
  const applicationUrl = new URL(config.callbackPath, baseUrl);
  const issued = issueVibyCallbackState({
    flow: "admin",
    callbackPath: config.callbackPath,
    returnTo: "/admin/dashboard",
    source: config.source,
  });
  applicationUrl.searchParams.set("state", issued.state.state);
  const startUrl = new URL(
    `/apps/${vibyAppSlug()}/start`,
    vibyBaseUrl({ allowDefault: false }),
  );
  startUrl.searchParams.set("mode", config.mode);
  startUrl.searchParams.set("callbackUrl", applicationUrl.toString());
  startUrl.searchParams.set("context", JSON.stringify({
    mode: config.mode,
    source: config.source,
    forceIdentityCheck: true,
  }));
  startUrl.searchParams.set("freshIdentity", "1");
  const response = NextResponse.redirect(startUrl, 303);
  setVibyCallbackStateCookie(response, issued.cookieValue);
  response.headers.set("Cache-Control", "no-store");
  return Promise.resolve(response);
}

export async function GET(request: NextRequest) {
  const requestedFlow = request.nextUrl.searchParams.get("flow") as VibyCallbackFlow | "application" | "judge" | null;
  const config = requestedFlow ? flows[requestedFlow] : undefined;
  if (!requestedFlow || !config) return errorResponse();
  const flow = requestedFlow;

  if (flow === "application" || flow === "admin" || flow === "judge") {
    return NextResponse.json(
      { error: "Interactive Viby sign-in requires a same-origin POST." },
      { status: 405, headers: { Allow: "POST" } },
    );
  }

  const projectId = flow === "artifact" ? request.nextUrl.searchParams.get("projectId")?.trim() : undefined;
  const artifactType = flow === "artifact" ? request.nextUrl.searchParams.get("artifactType")?.trim() : undefined;
  if (flow === "artifact" && (!projectId || !artifactType)) return errorResponse();

  let baseUrl: string;
  let applicationUrl: URL;
  try {
    baseUrl = getBaseUrl();
    applicationUrl = new URL(config.callbackPath, baseUrl);
    const issued = issueVibyCallbackState({
      flow,
      callbackPath: config.callbackPath,
      returnTo: config.callbackPath,
      source: config.source,
      ...(projectId ? { projectId } : {}),
      ...(artifactType ? { artifactType } : {}),
    });
    applicationUrl.searchParams.set("state", issued.state.state);

    const startUrl = new URL(`/apps/${vibyAppSlug()}/start`, vibyBaseUrl({ allowDefault: false }));
    startUrl.searchParams.set("mode", config.mode);
    startUrl.searchParams.set("callbackUrl", applicationUrl.toString());
    startUrl.searchParams.set("context", JSON.stringify({ mode: config.mode, source: config.source }));
    startUrl.searchParams.set("preferredActor", "agent");

    const response = NextResponse.redirect(startUrl);
    setVibyCallbackStateCookie(response, issued.cookieValue);
    return response;
  } catch {
    return NextResponse.json({ error: "Viby login is not configured." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  let origin: string;
  try {
    origin = canonicalizeConfiguredBaseUrl(getBaseUrl());
  } catch {
    return NextResponse.json({ error: "Viby login is not configured." }, { status: 503 });
  }
  if (strictSameOriginFailure(request, origin)) {
    return NextResponse.json({ error: "The request origin is not allowed." }, { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const flow = form?.get("flow");
  if (flow !== "application" && flow !== "admin" && flow !== "judge") return errorResponse();
  const returnTo = typeof form?.get("returnTo") === "string" ? String(form.get("returnTo")) : null;

  try {
    if (flow === "application") {
      return beginFreshVibySignIn(request, {
        operation: "application_login",
        createLaunchResponse: () => createApplicationVibyStartResponse(request, {
          returnTo,
          reason: "routine",
          redirectStatus: 303,
        }),
      });
    }
    if (flow === "admin") {
      const adminMode = vibyAdminSessionMode();
      if (adminMode === "disabled") {
        return NextResponse.json({ error: "Viby administrator login is disabled." }, { status: 503 });
      }
      return beginFreshVibySignIn(request, {
        operation: "admin_login",
        preserveCookies: adminMode === "legacy" ? [VIBY_CALLBACK_STATE_COOKIE] : undefined,
        createLaunchResponse: () => adminMode === "legacy"
          ? createLegacyAdminVibyStartResponse()
          : createAdminVibyStartResponse(request, { returnTo }),
      });
    }
    return beginFreshVibySignIn(request, {
      operation: "judge_login",
      createLaunchResponse: () => createJudgeVibyStartResponse(request, {
        freshnessRequired: true,
        reason: "routine",
        returnTo,
        redirectStatus: 303,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to start Viby sign-in safely." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
