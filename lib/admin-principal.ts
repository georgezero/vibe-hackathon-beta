import { createHash } from "node:crypto";
import {
  resolveApplicationPrincipal,
  type ApplicationPrincipal,
} from "@/lib/application-principal";
import {
  ADMIN_SESSION_COOKIE,
  AdminSessionConfigurationError,
  decodeAdminSession,
  type AdminSession,
} from "@/lib/admin-session";
import { isAuthorizedAdminVibyUser } from "@/lib/viby-identity-links";

export interface AdminPrincipal {
  authentication_mechanism: "better-auth" | "viby";
  local_user_id: string | null;
  viby_user_id: string | null;
  display_name: string;
  role: "admin";
  authorization_source: "admin_authorization";
  audit_id: string;
  issued_at: number;
  expires_at: number;
  identity_method: string | null;
  identity_confidence: number | null;
}

export type AdminPrincipalResolution =
  | { status: "authorized"; principal: AdminPrincipal }
  | { status: "unauthenticated" }
  | {
    status: "forbidden";
    reason:
      | "not_authorized"
      | "conflicting_sessions"
      | "password_change_required";
  }
  | { status: "unavailable" };

function auditId(kind: string, identifier: string) {
  return createHash("sha256").update(`${kind}:${identifier}`).digest("hex").slice(0, 16);
}

function fromApplicationPrincipal(
  principal: ApplicationPrincipal,
): AdminPrincipal | null {
  if (!principal.roles.isAdmin || !principal.authorizations.admin) return null;
  return {
    authentication_mechanism: "better-auth",
    local_user_id: principal.user.id,
    viby_user_id: null,
    display_name: principal.user.name?.trim() || "Administrator",
    role: "admin",
    authorization_source: "admin_authorization",
    audit_id: auditId("better-auth", principal.user.id),
    issued_at: principal.session.createdAt.getTime(),
    expires_at: principal.session.expiresAt.getTime(),
    identity_method: principal.sessionProvenance.authenticationMethod,
    identity_confidence: null,
  };
}

type LegacyCandidate = {
  present: boolean;
  authenticated: boolean;
  principal: AdminPrincipal | null;
};

async function legacyVibyPrincipal(headers: Headers): Promise<LegacyCandidate> {
  const cookie = headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_SESSION_COOKIE}=([^;]+)`));
  if (!match) return { present: false, authenticated: false, principal: null };

  let session: AdminSession | null;
  try {
    session = decodeAdminSession(decodeURIComponent(match[1]));
  } catch (error) {
    if (error instanceof AdminSessionConfigurationError) throw error;
    return { present: true, authenticated: false, principal: null };
  }
  if (!session) return { present: true, authenticated: false, principal: null };
  if (!await isAuthorizedAdminVibyUser(session.viby_user_id)) {
    return { present: true, authenticated: true, principal: null };
  }

  return {
    present: true,
    authenticated: true,
    principal: {
      authentication_mechanism: "viby",
      local_user_id: null,
      viby_user_id: session.viby_user_id,
      display_name: session.display_name,
      role: "admin",
      authorization_source: "admin_authorization",
      audit_id: auditId("viby", session.viby_user_id),
      issued_at: session.issued_at,
      expires_at: session.expires_at,
      identity_method: session.identity_method,
      identity_confidence: session.identity_confidence,
    },
  };
}

/**
 * Compatibility view for existing administrator callers.
 *
 * Better Auth identity, provenance, and authorization resolve through the
 * role-neutral application principal. The bounded legacy Viby cookie remains
 * isolated here until its separately approved retirement phase.
 */
export async function resolveAdminPrincipal(
  headers: Headers,
): Promise<AdminPrincipalResolution> {
  try {
    const [application, legacy] = await Promise.all([
      resolveApplicationPrincipal(headers),
      legacyVibyPrincipal(headers),
    ]);

    if (application.status === "unavailable") return { status: "unavailable" };
    if (
      application.status === "authenticated"
      && application.principal.account.passwordChangeRequired
    ) {
      return { status: "forbidden", reason: "password_change_required" };
    }

    const betterAuth = application.status === "authenticated"
      ? fromApplicationPrincipal(application.principal)
      : null;

    if (betterAuth && legacy.principal) {
      return { status: "forbidden", reason: "conflicting_sessions" };
    }
    if (betterAuth) return { status: "authorized", principal: betterAuth };
    if (legacy.principal) return { status: "authorized", principal: legacy.principal };

    if (
      application.status === "authenticated"
      || application.status === "forbidden"
      || legacy.authenticated
    ) {
      return { status: "forbidden", reason: "not_authorized" };
    }
    return { status: "unauthenticated" };
  } catch {
    return { status: "unavailable" };
  }
}
