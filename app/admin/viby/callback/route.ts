import { NextRequest, NextResponse } from "next/server";
import { createAdminSessionCookie } from "@/lib/admin-session";
import { logAdminAudit } from "@/lib/admin-audit";
import { isAuthorizedAdminVibyUser } from "@/lib/viby-identity-links";
import { clearVibyCallbackStateCookie, validateVibyCallbackState } from "@/lib/viby-callback-state";
import { verifyVibyAssertion, VibyAssertionError } from "@/lib/viby";
import { vibyAdminSessionMode } from "@/lib/viby";
import {
  inspectVibyLoginTransactionState,
  VIBY_BROWSER_BINDING_COOKIE,
  VIBY_HANDOFF_COOKIE,
} from "@/lib/viby-login-transactions";
import { handleUnifiedVibyCallback } from "@/lib/viby-unified-callback";

function vibeBaseUrl(req: NextRequest) {
  return (process.env.VIBE_HACKATHON_BASE_URL ?? req.nextUrl.origin).replace(/\/$/, "");
}

function redirectAdmin(req: NextRequest, params: Record<string, string>) {
  const response = NextResponse.redirect(new URL(`/admin?${new URLSearchParams(params)}`, vibeBaseUrl(req)));
  clearVibyCallbackStateCookie(response);
  for (const name of [VIBY_BROWSER_BINDING_COOKIE, VIBY_HANDOFF_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: vibeBaseUrl(req).startsWith("https://"),
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

function redirectDashboard(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/dashboard", vibeBaseUrl(req)));
  clearVibyCallbackStateCookie(response);
  return response;
}

async function handleAssertionCallback(req: NextRequest, assertionId: string | null, stateOverride?: string | null) {
  const state = stateOverride ?? req.nextUrl.searchParams.get("state") ?? "";
  const transactionState = await inspectVibyLoginTransactionState(state);
  if (transactionState.found) {
    return handleUnifiedVibyCallback(req, {
      assertionId,
      stateOverride,
    });
  }
  const mode = vibyAdminSessionMode();
  if (mode === "disabled") {
    return redirectAdmin(req, { viby_status: "error", reason: "viby_login_disabled" });
  }
  if (mode === "better-auth") {
    return handleUnifiedVibyCallback(req, {
      assertionId,
      stateOverride,
    });
  }
  const callbackState = validateVibyCallbackState(req, "admin", "/admin/viby/callback", stateOverride);
  if (!callbackState) {
    await logAdminAudit("viby_admin_assertion_denied", { reason: "invalid_callback_state", validation_stage: "state" });
    return redirectAdmin(req, { viby_status: "error", reason: "invalid_callback_state" });
  }

  const vibyStatus = req.nextUrl.searchParams.get("viby_status");
  const reason = req.nextUrl.searchParams.get("reason") ?? undefined;
  if (!assertionId && (vibyStatus === "denied" || vibyStatus === "error")) {
    await logAdminAudit("viby_admin_assertion_denied", { reason: reason ?? vibyStatus, viby_status: vibyStatus });
    return redirectAdmin(req, { viby_status: vibyStatus, ...(reason ? { reason } : {}) });
  }

  if (!assertionId) {
    await logAdminAudit("viby_admin_assertion_denied", { reason: "missing_assertion", validation_stage: "assertion" });
    return redirectAdmin(req, { viby_status: "error", reason: "missing_assertion" });
  }

  try {
    const assertion = await verifyVibyAssertion(assertionId);
    if (!await isAuthorizedAdminVibyUser(assertion.vibyUserId)) {
      await logAdminAudit("viby_admin_assertion_denied", { reason: "not_allowlisted", audience: assertion.audience });
      return redirectAdmin(req, { viby_status: "denied", reason: "not_allowlisted" });
    }

    await createAdminSessionCookie({
      vibyUserId: assertion.vibyUserId,
      displayName: assertion.displayName,
      identityMethod: assertion.method,
      identityConfidence: assertion.confidence,
    });
    await logAdminAudit("viby_admin_session_created", {
      method: assertion.method,
      confidence: assertion.confidence,
      audience: assertion.audience,
      validation_stage: "callback_complete",
    });
    return redirectDashboard(req);
  } catch (err) {
    const code = err instanceof VibyAssertionError ? err.code : "unknown";
    await logAdminAudit("viby_admin_assertion_denied", { reason: code, validation_stage: "assertion" });
    return redirectAdmin(req, { viby_status: "error", reason: code });
  }
}

export async function GET(req: NextRequest) {
  const assertionId = req.nextUrl.searchParams.get("assertionId")
    ?? req.nextUrl.searchParams.get("assertion_id")
    ?? req.nextUrl.searchParams.get("id");
  return handleAssertionCallback(req, assertionId);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const assertionId = String(form.get("assertionId") ?? form.get("assertion_id") ?? form.get("id") ?? "");
  return handleAssertionCallback(req, assertionId || null, String(form.get("state") ?? "") || null);
}
