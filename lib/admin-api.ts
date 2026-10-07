import { NextRequest, NextResponse } from "next/server";
import { logAdminAudit } from "@/lib/admin-audit";
import {
  resolveAdminPrincipal,
  type AdminPrincipal,
} from "@/lib/admin-principal";
import {
  ADMIN_API_POLICIES,
  type AdminApiPolicy,
  type AdminApiPolicyKey,
} from "@/lib/admin-api-policy";
import {
  isExplicitDevelopmentRuntime,
  isProductionSafeRuntime,
} from "@/lib/runtime-mode";
import { canonicalizeConfiguredBaseUrl } from "@/lib/base-url";
import { strictSameOriginFailure } from "@/lib/same-origin";

export interface AdminApiAuthorization {
  session: AdminPrincipal | null;
}

type AdminApiHandler<Context> = (
  request: NextRequest,
  context: Context,
  authorization: AdminApiAuthorization,
) => Response | Promise<Response>;

interface AdminApiConfiguration {
  canonicalOrigin: string;
}

function unavailable() {
  return NextResponse.json(
    { error: "Admin authentication is unavailable." },
    { status: 503 },
  );
}

function unauthorized() {
  return NextResponse.json(
    { error: "A valid organizer session is required." },
    { status: 401 },
  );
}

function forbidden(message = "This organizer identity is not authorized.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

function loadAdminApiConfiguration(): AdminApiConfiguration | null {
  const productionSafe = isProductionSafeRuntime();
  const configuredBaseUrl = process.env.VIBE_HACKATHON_BASE_URL?.trim() ?? "";

  if (!configuredBaseUrl) return null;
  if (productionSafe && process.env.VIBE_ENABLE_ADMIN_DEV_FALLBACK === "true") return null;
  if (productionSafe && process.env.VIBE_ADMIN_COOKIE_SECURE === "false") return null;

  let canonicalOrigin: string;
  try {
    canonicalOrigin = canonicalizeConfiguredBaseUrl(configuredBaseUrl);
  } catch {
    return null;
  }

  return {
    canonicalOrigin,
  };
}

function routeParts(policyKey: AdminApiPolicyKey) {
  const separator = policyKey.indexOf(" ");
  return {
    method: policyKey.slice(0, separator),
    route: policyKey.slice(separator + 1),
  };
}

async function logAccessDenied(
  policyKey: AdminApiPolicyKey,
  reason: string,
  session?: AdminPrincipal,
) {
  const { method, route } = routeParts(policyKey);
  await logAdminAudit("admin_api_access_denied", {
    audit_id: session?.audit_id ?? null,
    method,
    route,
    timestamp: new Date().toISOString(),
    success: false,
    reason,
  });
}

async function logMutationResult(
  policyKey: AdminApiPolicyKey,
  session: AdminPrincipal,
  success: boolean,
  status: number,
) {
  const { method, route } = routeParts(policyKey);
  await logAdminAudit("admin_api_mutation", {
    audit_id: session.audit_id,
    method,
    route,
    timestamp: new Date().toISOString(),
    success,
    status,
  });
}

export function withAdminApi<Context = unknown>(
  policyKey: AdminApiPolicyKey,
  handler: AdminApiHandler<Context>,
) {
  const policy: AdminApiPolicy = ADMIN_API_POLICIES[policyKey];

  return async (request: NextRequest, context: Context): Promise<Response> => {
    if (policy.access === "intentionally-public") {
      return handler(request, context, {
        session: null,
      });
    }

    if (policy.access === "development-only" && !isExplicitDevelopmentRuntime()) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const configuration = loadAdminApiConfiguration();
    if (!configuration) return unavailable();

    const resolution = await resolveAdminPrincipal(request.headers);
    if (resolution.status === "unavailable") return unavailable();
    if (resolution.status === "unauthenticated") return unauthorized();
    if (resolution.status === "forbidden") {
      await logAccessDenied(policyKey, resolution.reason);
      return forbidden(resolution.reason === "conflicting_sessions"
        ? "Conflicting organizer sessions must be cleared before continuing."
        : undefined);
    }
    const session = resolution.principal;

    if (policy.mutation) {
      const csrfReason = strictSameOriginFailure(
        request,
        configuration.canonicalOrigin,
      );
      if (csrfReason) {
        await logAccessDenied(policyKey, csrfReason, session);
        return forbidden("The request origin is not allowed.");
      }
    }

    try {
      const response = await handler(request, context, { session });
      if (policy.mutation) {
        await logMutationResult(policyKey, session, response.ok, response.status);
      }
      return response;
    } catch (error) {
      if (policy.mutation) {
        await logMutationResult(policyKey, session, false, 500);
      }
      throw error;
    }
  };
}
