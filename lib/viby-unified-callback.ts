import { NextRequest, NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/admin-audit";
import { logJudgeAudit } from "@/lib/judge-audit";
import { logApplicationAudit } from "@/lib/application-audit";
import { createApplicationVibyStartResponse } from "@/lib/application-viby-start";
import { createJudgeVibyStartResponse } from "@/lib/judge-viby-start";
import {
  hasCurrentFreshVibyEvidence,
  verifyVibyAssertion,
  VibyAssertionError,
} from "@/lib/viby";
import {
  activeVibyUserLink,
  consumeVibyLoginTransaction,
  createVibySessionHandoff,
  inspectVibyLoginTransactionState,
  VIBY_BROWSER_BINDING_COOKIE,
  VIBY_HANDOFF_COOKIE,
} from "@/lib/viby-login-transactions";
import {
  classifyVibyIdentity,
  createPendingVibyLink,
  VIBY_LINK_BINDING_COOKIE,
  VIBY_LINK_TOKEN_COOKIE,
} from "@/lib/viby-interactive-linking";
import {
  isVibyLoginOperation,
  safeVibyReturnTo,
  vibyLoginPolicy,
  type VibyLoginOperation,
} from "@/lib/viby-login-policy";
import {
  bindInvitationLinkTransaction,
  invitationForLoginTransaction,
} from "@/lib/account-invitation-viby";
import {
  acceptInvitationAfterViby,
  ACCOUNT_INVITATION_COOKIE,
  invitationTokenHash,
} from "@/lib/account-invitations";

function applicationOrigin(req: NextRequest) {
  return (process.env.VIBE_HACKATHON_BASE_URL ?? req.nextUrl.origin).replace(/\/$/, "");
}

function clearCookie(response: NextResponse, req: NextRequest, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: applicationOrigin(req).startsWith("https://"),
    path: "/",
    maxAge: 0,
  });
}

function redirectFailure(
  req: NextRequest,
  operation: VibyLoginOperation,
  reason: string,
) {
  const policy = vibyLoginPolicy(operation);
  const params = operation === "admin_login"
    ? { viby_status: "error", reason }
    : { viby_status: "error", reason };
  const response = NextResponse.redirect(
    new URL(`${policy.entryPath}?${new URLSearchParams(params)}`, applicationOrigin(req)),
  );
  clearCookie(response, req, VIBY_BROWSER_BINDING_COOKIE);
  clearCookie(response, req, VIBY_HANDOFF_COOKIE);
  return response;
}

async function auditDenied(
  operation: VibyLoginOperation,
  reason: string,
  correlationId?: string,
) {
  if (operation === "judge_login") {
    await logJudgeAudit("judge_viby_login_denied", {
      reason,
      route: vibyLoginPolicy(operation).callbackPath,
      authorizationId: correlationId,
    });
    return;
  }
  if (operation === "application_login") {
    await logApplicationAudit("application_viby_login_denied", { reason, route: vibyLoginPolicy(operation).callbackPath, correlationId });
    return;
  }
  await logAdminAudit("viby_admin_assertion_denied", {
    reason,
    validation_stage: "assertion",
    correlation_id: correlationId,
  });
}

export async function handleUnifiedVibyCallback(
  req: NextRequest,
  input: {
    assertionId: string | null;
    stateOverride?: string | null;
  },
) {
  const { assertionId } = input;
  const state = input.stateOverride ?? req.nextUrl.searchParams.get("state") ?? "";
  const browserBinding = req.cookies.get(VIBY_BROWSER_BINDING_COOKIE)?.value ?? "";
  const stateInspection = await inspectVibyLoginTransactionState(state);
  const denialOperation = stateInspection.operation ?? "admin_login";
  const transaction = state && browserBinding
    ? await consumeVibyLoginTransaction({ state, browserBinding })
    : null;
  if (!transaction) {
    await auditDenied(denialOperation, "invalid_or_replayed_callback");
    return redirectFailure(req, denialOperation, "invalid_callback_state");
  }
  if (!isVibyLoginOperation(transaction.operation)) {
    await auditDenied("admin_login", "unknown_operation", transaction.id);
    return redirectFailure(req, "admin_login", "invalid_callback_state");
  }
  const operation = transaction.operation;
  if (
    stateInspection.operation !== null
    && stateInspection.operation !== operation
  ) {
    await auditDenied(operation, "transaction_operation_mismatch", transaction.id);
    return redirectFailure(req, operation, "invalid_callback_state");
  }
  const policy = vibyLoginPolicy(operation);
  if (policy.routineFreshnessRequired && !transaction.freshnessRequired) {
    await auditDenied(operation, "freshness_policy_mismatch", transaction.id);
    return redirectFailure(req, operation, "invalid_callback_state");
  }
  const invitationContext = await invitationForLoginTransaction(transaction.id);
  if (invitationContext) {
    const invitationToken = req.cookies.get(ACCOUNT_INVITATION_COOKIE)?.value ?? "";
    if (
      !invitationToken
      || invitationTokenHash(invitationToken) !== invitationContext.tokenHash
      || invitationContext.status !== "pending"
      || invitationContext.expiresAt.getTime() <= Date.now()
    ) {
      await auditDenied(operation, "invalid_invitation", transaction.id);
      return redirectFailure(req, operation, "invalid_invitation");
    }
  }
  if (!assertionId) {
    await auditDenied(operation, "missing_assertion", transaction.id);
    return redirectFailure(req, operation, "missing_assertion");
  }

  try {
    const assertion = await verifyVibyAssertion(assertionId, {
      confidential: true,
      requireFresh: transaction.freshnessRequired || policy.routineFreshnessRequired,
      expectedCallbackState: state,
    });
    if (assertion.audience !== transaction.expectedAudience) {
      throw new VibyAssertionError(
        "wrong_audience",
        "The assertion audience does not match the login transaction.",
      );
    }
    const environment = new URL(applicationOrigin(req)).origin;
    const identityState = await classifyVibyIdentity({
      subject: assertion.vibyUserId,
      applicationId: "vibe-hackathon",
      environment,
    });
    if (
      identityState.kind === "revoked"
      || identityState.kind === "conflict"
      || identityState.kind === "ambiguous"
    ) {
      if (operation === "judge_login") {
        await logJudgeAudit("judge_viby_link_conflict", {
          reason: identityState.kind,
          route: policy.callbackPath,
          authorizationId: transaction.id,
        });
      } else {
        await logAdminAudit("viby_identity_link_failed", {
          reason: identityState.kind === "revoked" ? "revoked_link" : "ambiguous_link",
          validation_stage: "identity_link",
          correlation_id: transaction.id,
        });
      }
      return redirectFailure(
        req,
        operation,
        identityState.kind === "revoked" ? "revoked_link" : "identity_link_conflict",
      );
    }

    if (
      identityState.kind === "absent"
      || identityState.kind === "unbound_legacy_claimable"
    ) {
      if (
        operation === "admin_login"
        && identityState.kind === "unbound_legacy_claimable"
      ) {
        await logAdminAudit("viby_legacy_identity_detected", {
          correlation_id: transaction.id,
          validation_stage: "identity_link",
        });
      }
      if (!hasCurrentFreshVibyEvidence(assertion)) {
        if (!policy.rememberedLoginAllowed) {
          throw new VibyAssertionError(
            "wrong_context",
            "Current fresh verification is required to create an identity link.",
          );
        }
        if (operation === "judge_login") {
          await logJudgeAudit("judge_viby_fresh_required", {
            reason: "unlinked_remembered_identity",
            route: policy.callbackPath,
            authorizationId: transaction.id,
          });
          return createJudgeVibyStartResponse(req, {
            freshnessRequired: true,
            reason: "fresh_link_step_up",
            returnTo: safeVibyReturnTo(operation, transaction.returnTo),
          });
        }
        await logApplicationAudit("application_viby_login_denied", {
          reason: "fresh_link_step_up",
          route: policy.callbackPath,
        });
        return createApplicationVibyStartResponse(req, {
          freshnessRequired: true,
          reason: "fresh_link_step_up",
          returnTo: safeVibyReturnTo(operation, transaction.returnTo),
        });
      }

      const pending = await createPendingVibyLink({
        operation,
        subject: assertion.vibyUserId,
        identitySessionId: assertion.sessionId!,
        verifiedAt: assertion.verifiedAt,
        assertionId: assertion.assertionId,
        returnTo: transaction.returnTo,
        environment,
        classification: identityState,
        expectedUserId: invitationContext?.userId,
      });
      if (invitationContext && !await bindInvitationLinkTransaction({
        loginTransactionId: transaction.id,
        linkTransactionId: pending.transaction.id,
      })) {
        return redirectFailure(req, operation, "invalid_invitation");
      }
      if (operation === "judge_login") {
        await logJudgeAudit("judge_viby_link_started", {
          reason: identityState.kind,
          route: policy.linkPath,
          authorizationId: pending.transaction.id,
        });
      } else if (operation === "admin_login") {
        await logAdminAudit("viby_identity_link_pending_created", {
          correlation_id: pending.transaction.id,
          validation_stage: "identity_link",
          reason: identityState.kind,
        });
      } else {
        await logApplicationAudit("application_viby_link_started", {
          route: policy.linkPath,
          reason: identityState.kind,
        });
      }
      const response = NextResponse.redirect(new URL(
        invitationContext ? "/invite/link-viby" : policy.linkPath,
        applicationOrigin(req),
      ));
      for (const [name, value] of [
        [VIBY_LINK_TOKEN_COOKIE, pending.token],
        [VIBY_LINK_BINDING_COOKIE, pending.browserBinding],
      ] as const) {
        response.cookies.set(name, value, {
          httpOnly: true,
          sameSite: "lax",
          secure: applicationOrigin(req).startsWith("https://"),
          path: "/",
          maxAge: 10 * 60,
        });
      }
      clearCookie(response, req, VIBY_BROWSER_BINDING_COOKIE);
      return response;
    }

    const linked = await activeVibyUserLink(assertion.vibyUserId);
    if (!linked?.link.localUserId) {
      throw new VibyAssertionError(
        "invalid_payload",
        "The identity link changed during callback processing.",
      );
    }
    if (invitationContext) {
      if (linked.link.localUserId !== invitationContext.userId) {
        await auditDenied(operation, "invitation_identity_conflict", transaction.id);
        return redirectFailure(req, operation, "identity_link_conflict");
      }
      acceptInvitationAfterViby({
        token: req.cookies.get(ACCOUNT_INVITATION_COOKIE)?.value ?? "",
        expectedUserId: invitationContext.userId,
      });
    }
    const handoff = await createVibySessionHandoff({
      operation,
      transactionId: transaction.id,
      identityLinkId: linked.link.id,
      userId: linked.user.id,
      vibySubject: assertion.vibyUserId,
      returnTo: transaction.returnTo,
      verificationKind: assertion.verificationKind,
      verifiedAt: assertion.verifiedAt,
    });
    const response = NextResponse.redirect(
      new URL("/api/auth/viby/complete", applicationOrigin(req)),
    );
    response.cookies.set(VIBY_HANDOFF_COOKIE, handoff, {
      httpOnly: true,
      sameSite: "lax",
      secure: applicationOrigin(req).startsWith("https://"),
      path: "/",
      maxAge: 60,
    });
    clearCookie(response, req, VIBY_BROWSER_BINDING_COOKIE);
    return response;
  } catch (error) {
    const code = error instanceof VibyAssertionError ? error.code : "unknown";
    await auditDenied(operation, code, transaction.id);
    return redirectFailure(req, operation, code);
  }
}
