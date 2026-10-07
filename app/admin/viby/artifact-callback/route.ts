import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { logAdminAudit } from "@/lib/admin-audit";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import {
  VERIFIED_ARTIFACT_COOKIE,
  createVerifiedArtifact,
  encodeVerifiedArtifact,
  normalizeArtifactType,
} from "@/lib/verifiedArtifacts";
import { clearVibyCallbackStateCookie, validateVibyCallbackState } from "@/lib/viby-callback-state";
import { verifyVibyAgentAttributionAssertion, VibyAssertionError } from "@/lib/viby";

function vibeBaseUrl(req: NextRequest) {
  return (process.env.VIBE_HACKATHON_BASE_URL ?? req.nextUrl.origin).replace(/\/$/, "");
}

function resultUrl(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/admin/verified-agent-artifacts", vibeBaseUrl(req));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

function shouldUseSecureCookie() {
  if (process.env.VIBE_ADMIN_COOKIE_SECURE === "true") return true;
  if (process.env.VIBE_ADMIN_COOKIE_SECURE === "false") return false;
  return Boolean(process.env.VIBE_HACKATHON_BASE_URL?.startsWith("https://"));
}

function finish(req: NextRequest, params: Record<string, string>, artifact?: string) {
  const response = NextResponse.redirect(resultUrl(req, params));
  clearVibyCallbackStateCookie(response);
  if (artifact) {
    response.cookies.set(VERIFIED_ARTIFACT_COOKIE, artifact, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(),
      path: "/admin/verified-agent-artifacts",
      maxAge: 10 * 60,
    });
  }
  return response;
}

export async function GET(req: NextRequest) {
  const callbackState = validateVibyCallbackState(req, "artifact", "/admin/viby/artifact-callback");
  if (!callbackState) {
    await logAdminAudit("viby_verified_artifact_denied", { reason: "invalid_callback_state", validation_stage: "state" });
    return finish(req, { viby_status: "error", reason: "invalid_callback_state" });
  }

  const projectId = callbackState.projectId ?? "";
  const artifactType = normalizeArtifactType(callbackState.artifactType);
  const vibyStatus = req.nextUrl.searchParams.get("viby_status");
  const reason = req.nextUrl.searchParams.get("reason") ?? undefined;
  const assertionId = req.nextUrl.searchParams.get("assertionId")
    ?? req.nextUrl.searchParams.get("assertion_id")
    ?? req.nextUrl.searchParams.get("id");

  if (!assertionId && (vibyStatus === "denied" || vibyStatus === "error")) {
    await logAdminAudit("viby_verified_artifact_denied", { viby_status: vibyStatus, reason: reason ?? vibyStatus, artifact_type: artifactType });
    return finish(req, { viby_status: vibyStatus, ...(reason ? { reason } : {}), ...(projectId ? { projectId } : {}), artifactType });
  }
  if (!projectId) {
    await logAdminAudit("viby_verified_artifact_denied", { reason: "missing_project" });
    return finish(req, { viby_status: "error", reason: "missing_project", artifactType });
  }
  if (!assertionId) {
    await logAdminAudit("viby_verified_artifact_denied", { reason: "missing_assertion", artifact_type: artifactType });
    return finish(req, { viby_status: "error", reason: "missing_assertion", projectId, artifactType });
  }

  try {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, projectId));
    if (!submission) {
      await logAdminAudit("viby_verified_artifact_denied", { reason: "project_not_found" });
      return finish(req, { viby_status: "error", reason: "project_not_found", projectId, artifactType });
    }
    const assertion = await verifyVibyAgentAttributionAssertion(assertionId);
    const artifact = createVerifiedArtifact({
      assertion,
      artifactType,
      projectId: submission.id,
      projectTitle: submission.projectTitle ?? submission.teamName,
      teamName: submission.teamName,
      problemStatement: submission.problemStatement,
      targetUsers: submission.targetUsers,
    });
    await logAdminAudit("viby_verified_artifact_created", {
      actor_type: artifact.signature.actorType,
      artifact_type: artifact.artifactType,
      action_name: artifact.actionName,
      artifact_hash: artifact.sha256,
      validation_stage: "callback_complete",
    });
    return finish(req, { viby_status: "allowed", projectId, artifactType }, encodeVerifiedArtifact(artifact));
  } catch (err) {
    const code = err instanceof VibyAssertionError ? err.code : "unknown";
    await logAdminAudit("viby_verified_artifact_denied", { reason: code, artifact_type: artifactType, validation_stage: "assertion" });
    return finish(req, { viby_status: "error", reason: code, projectId, artifactType });
  }
}
