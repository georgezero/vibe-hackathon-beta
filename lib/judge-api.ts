import { NextRequest, NextResponse } from "next/server";
import { canonicalizeConfiguredBaseUrl } from "@/lib/base-url";
import {
  JUDGE_API_POLICIES,
  type JudgeApiPolicy,
  type JudgeApiPolicyKey,
} from "@/lib/judge-api-policy";
import {
  resolveJudgePrincipal,
  type JudgePrincipalResolution,
} from "@/lib/judge-principal";
import { currentJudgingEventId } from "@/lib/judging-event";
import { logJudgeAudit } from "@/lib/judge-audit";
import { strictSameOriginFailure } from "@/lib/same-origin";

export interface JudgeApiAuthorization {
  judge: { id: string; name: string };
  eventId: string;
  authentication: "better-auth";
  applicationUserId: string;
  judgeAuthorizationId: string;
}

type JudgeApiHandler<Context> = (
  request: NextRequest,
  context: Context,
  authorization: JudgeApiAuthorization,
) => Response | Promise<Response>;

type RequestAuthorization =
  | { status: "authorized"; authorization: JudgeApiAuthorization }
  | { status: "unauthenticated" }
  | { status: "forbidden"; reason: string }
  | { status: "unavailable" };

function unavailable() {
  return NextResponse.json(
    { error: "Judge authentication is unavailable." },
    { status: 503 },
  );
}

function unauthorized() {
  return NextResponse.json(
    { error: "A valid application session is required." },
    { status: 401 },
  );
}

function forbidden(message = "This account is not authorized for judging.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function configuredOrigin() {
  const value = process.env.VIBE_HACKATHON_BASE_URL?.trim() ?? "";
  if (!value) return null;
  try {
    return canonicalizeConfiguredBaseUrl(value);
  } catch {
    return null;
  }
}

function fromPrincipalResolution(
  resolution: JudgePrincipalResolution,
): RequestAuthorization {
  if (resolution.status === "signed_out") return { status: "unauthenticated" };
  if (resolution.status === "unavailable") return { status: "unavailable" };
  if (resolution.status === "forbidden") {
    return { status: "forbidden", reason: resolution.reason };
  }
  const {
    applicationPrincipal,
    judgeAuthorization,
    judgeProfile,
    event,
  } = resolution.principal;
  return {
    status: "authorized",
    authorization: {
      judge: { id: judgeProfile.id, name: judgeProfile.name },
      eventId: event.id,
      authentication: "better-auth",
      applicationUserId: applicationPrincipal.user.id,
      judgeAuthorizationId: judgeAuthorization.id,
    },
  };
}

export function withJudgeApi<Context = unknown>(
  policyKey: JudgeApiPolicyKey,
  handler: JudgeApiHandler<Context>,
) {
  const policy: JudgeApiPolicy = JUDGE_API_POLICIES[policyKey];

  return async (request: NextRequest, context: Context): Promise<Response> => {
    const canonicalOrigin = configuredOrigin();
    if (!canonicalOrigin) return unavailable();

    const resolution = fromPrincipalResolution(
      await resolveJudgePrincipal(request.headers, {
        eventId: currentJudgingEventId(),
      }),
    );
    if (resolution.status === "unavailable") return unavailable();
    if (resolution.status === "unauthenticated") return unauthorized();
    if (resolution.status === "forbidden") {
      await logJudgeAudit("judge_access_denied", {
        eventId: currentJudgingEventId(),
        route: policyKey,
        reason: resolution.reason,
      });
      return forbidden();
    }

    if (policy.mutation && strictSameOriginFailure(request, canonicalOrigin)) {
      return forbidden("The request origin is not allowed.");
    }

    return handler(request, context, resolution.authorization);
  };
}
