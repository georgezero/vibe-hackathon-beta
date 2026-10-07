import { NextRequest, NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/admin-audit";
import { clearVibyCallbackStateCookie, validateVibyCallbackState } from "@/lib/viby-callback-state";
import { verifyVibyAgentAttributionAssertion, VibyAssertionError } from "@/lib/viby";

function vibeBaseUrl(req: NextRequest) {
  return (process.env.VIBE_HACKATHON_BASE_URL ?? req.nextUrl.origin).replace(/\/$/, "");
}

function finish(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/agent-attribution-demo", vibeBaseUrl(req));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  clearVibyCallbackStateCookie(response);
  return response;
}

export async function GET(req: NextRequest) {
  const callbackState = validateVibyCallbackState(req, "agent", "/admin/viby/agent-callback");
  if (!callbackState) {
    await logAdminAudit("viby_agent_action_denied", { reason: "invalid_callback_state", validation_stage: "state" });
    return finish(req, { viby_status: "error", reason: "invalid_callback_state" });
  }

  const vibyStatus = req.nextUrl.searchParams.get("viby_status");
  const reason = req.nextUrl.searchParams.get("reason") ?? undefined;
  const assertionId = req.nextUrl.searchParams.get("assertionId")
    ?? req.nextUrl.searchParams.get("assertion_id")
    ?? req.nextUrl.searchParams.get("id");

  if (!assertionId && (vibyStatus === "denied" || vibyStatus === "error")) {
    await logAdminAudit("viby_agent_action_denied", { viby_status: vibyStatus, reason: reason ?? vibyStatus });
    return finish(req, { viby_status: vibyStatus, ...(reason ? { reason } : {}) });
  }
  if (!assertionId) {
    await logAdminAudit("viby_agent_action_denied", { reason: "missing_assertion", validation_stage: "assertion" });
    return finish(req, { viby_status: "error", reason: "missing_assertion" });
  }

  try {
    const assertion = await verifyVibyAgentAttributionAssertion(assertionId);
    await logAdminAudit("viby_agent_action_attributed", {
      actor_type: "agent",
      delegation_method: assertion.delegationMethod,
      audience: assertion.audience,
      validation_stage: "callback_complete",
    });
    return finish(req, { viby_status: "allowed", actor_type: "agent" });
  } catch (err) {
    const code = err instanceof VibyAssertionError ? err.code : "unknown";
    await logAdminAudit("viby_agent_action_denied", { reason: code, validation_stage: "assertion" });
    return finish(req, { viby_status: "error", reason: code });
  }
}
