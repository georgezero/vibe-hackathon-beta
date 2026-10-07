import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminAuthorizations } from "@/lib/db/schema";
import {
  getInteractiveSessionProvenance,
  type InteractiveAuthenticationMethod,
  type InteractiveSessionProvenanceResolution,
} from "@/lib/interactive-session-provenance";
import {
  resolveActiveJudgeAuthorization,
  type ActiveJudgeAuthorization,
  type JudgeAuthorizationResolution,
} from "@/lib/judge-authorizations";
import {
  DEFAULT_ACCOUNT_CONTROL,
  getAccountControlState,
  type AccountControlResolution,
} from "@/lib/account-controls";
import type { VibyLoginOperation } from "@/lib/viby-login-policy";

export interface ApplicationUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface ApplicationSession {
  id: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface ActiveAdminAuthorization {
  status: "active";
  grantSource: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AdminAuthorizationResolution =
  | { status: "none" }
  | { status: "active"; authorization: ActiveAdminAuthorization }
  | { status: "conflict" };

export interface ApplicationPrincipal {
  authenticationMechanism: "better-auth";
  user: ApplicationUser;
  session: ApplicationSession;
  account: {
    status: "active";
    passwordChangeRequired: boolean;
  };
  sessionProvenance: {
    authenticationMethod: InteractiveAuthenticationMethod;
    operation?: VibyLoginOperation;
    verificationKind?: "fresh" | "remembered" | null;
    verifiedAt?: Date | null;
  };
  linkedRuntimeIdentity?: {
    provider: "viby";
    displayName: string;
  };
  authorizations: {
    admin?: ActiveAdminAuthorization;
    judge?: ActiveJudgeAuthorization;
  };
  authorizationStates: {
    admin: "active" | "none";
    judge: "active" | "revoked" | "none" | "unresolved";
  };
  roles: {
    isAdmin: boolean;
    isJudge: boolean;
  };
}

export type ApplicationPrincipalResolution =
  | { status: "authenticated"; principal: ApplicationPrincipal }
  | { status: "unauthenticated" }
  | {
    status: "forbidden";
    reason:
      | "malformed_session"
      | "malformed_account_state"
      | "disabled_account"
      | "malformed_session_provenance"
      | "revoked_runtime_identity"
      | "conflicting_admin_authorizations"
      | "conflicting_judge_authorizations"
      | "invalid_event_context";
  }
  | { status: "unavailable" };

interface BetterAuthSessionResult {
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
  session: {
    id: string;
    createdAt: Date;
    expiresAt: Date;
  };
}

export interface ApplicationPrincipalDependencies {
  getSession(headers: Headers): Promise<BetterAuthSessionResult | null>;
  getSessionProvenance(
    sessionId: string,
  ): Promise<InteractiveSessionProvenanceResolution>;
  getAdminAuthorization(userId: string): Promise<AdminAuthorizationResolution>;
  getAccountControl?(
    userId: string,
  ): Promise<AccountControlResolution>;
  getJudgeAuthorization?(
    userId: string,
    eventId: string,
  ): Promise<JudgeAuthorizationResolution>;
}

export interface ApplicationPrincipalContext {
  eventId?: string;
}

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function validSession(result: BetterAuthSessionResult) {
  return Boolean(
    result.user.id?.trim()
    && result.user.email?.trim()
    && result.session.id?.trim()
    && validDate(result.session.createdAt)
    && validDate(result.session.expiresAt)
    && result.session.expiresAt.getTime() > Date.now(),
  );
}

export async function resolveLiveAdminAuthorization(
  userId: string,
): Promise<AdminAuthorizationResolution> {
  const rows = await db.select({
    status: adminAuthorizations.status,
    grantSource: adminAuthorizations.grantSource,
    createdAt: adminAuthorizations.createdAt,
    updatedAt: adminAuthorizations.updatedAt,
  }).from(adminAuthorizations)
    .where(and(
      eq(adminAuthorizations.userId, userId),
      eq(adminAuthorizations.status, "active"),
      isNull(adminAuthorizations.revokedAt),
    ))
    .limit(2);

  if (rows.length === 0) return { status: "none" };
  if (rows.length !== 1) return { status: "conflict" };
  return {
    status: "active",
    authorization: {
      status: "active",
      grantSource: rows[0].grantSource,
      createdAt: rows[0].createdAt,
      updatedAt: rows[0].updatedAt,
    },
  };
}

async function defaultGetSession(headers: Headers) {
  const { auth } = await import("@/lib/auth");
  return auth.api.getSession({ headers });
}

const defaultDependencies: ApplicationPrincipalDependencies = {
  getSession: defaultGetSession,
  getSessionProvenance: getInteractiveSessionProvenance,
  getAdminAuthorization: resolveLiveAdminAuthorization,
  getAccountControl: getAccountControlState,
  getJudgeAuthorization: resolveActiveJudgeAuthorization,
};

export function createApplicationPrincipalResolver(
  dependencies: ApplicationPrincipalDependencies,
) {
  return async function resolve(
    headers: Headers,
    context: ApplicationPrincipalContext = {},
  ): Promise<ApplicationPrincipalResolution> {
    try {
      if (context.eventId !== undefined && !context.eventId.trim()) {
        return { status: "forbidden", reason: "invalid_event_context" };
      }
      const session = await dependencies.getSession(headers);
      if (!session) return { status: "unauthenticated" };
      if (!validSession(session)) {
        return { status: "forbidden", reason: "malformed_session" };
      }

      const account = dependencies.getAccountControl
        ? await dependencies.getAccountControl(session.user.id)
        : { status: "valid" as const, control: DEFAULT_ACCOUNT_CONTROL };
      if (account.status === "invalid") {
        return { status: "forbidden", reason: "malformed_account_state" };
      }
      if (account.control.status === "disabled") {
        return { status: "forbidden", reason: "disabled_account" };
      }

      const provenance = await dependencies.getSessionProvenance(session.session.id);
      if (provenance.status === "invalid") {
        return { status: "forbidden", reason: "malformed_session_provenance" };
      }
      if (
        provenance.status === "valid"
        && (
          provenance.provenance.linkedRuntimeIdentity.status !== "active"
          || provenance.provenance.linkedRuntimeIdentity.revokedAt
        )
      ) {
        return { status: "forbidden", reason: "revoked_runtime_identity" };
      }

      const admin = await dependencies.getAdminAuthorization(session.user.id);
      if (admin.status === "conflict") {
        return { status: "forbidden", reason: "conflicting_admin_authorizations" };
      }
      const judge = context.eventId
        ? await dependencies.getJudgeAuthorization?.(session.user.id, context.eventId)
        : { status: "none" as const };
      if (!judge) return { status: "unavailable" };
      if (judge.status === "conflict") {
        return { status: "forbidden", reason: "conflicting_judge_authorizations" };
      }

      const authenticationMethod = provenance.status === "valid"
        ? provenance.provenance.authenticationMethod
        : "better_auth_session";

      return {
        status: "authenticated",
        principal: {
          authenticationMechanism: "better-auth",
          user: {
            id: session.user.id,
            name: session.user.name ?? null,
            email: session.user.email,
            image: session.user.image ?? null,
          },
          session: {
            id: session.session.id,
            createdAt: session.session.createdAt,
            expiresAt: session.session.expiresAt,
          },
          account: {
            status: "active",
            passwordChangeRequired: account.control.passwordChangeRequired,
          },
          sessionProvenance: {
            authenticationMethod,
            ...(provenance.status === "valid"
              ? {
                operation: provenance.provenance.operation,
                verificationKind: provenance.provenance.verificationKind,
                verifiedAt: provenance.provenance.verifiedAt,
              }
              : {}),
          },
          ...(provenance.status === "valid"
            ? {
              linkedRuntimeIdentity: {
                provider: provenance.provenance.linkedRuntimeIdentity.provider,
                displayName: provenance.provenance.linkedRuntimeIdentity.displayName,
              },
            }
            : {}),
          authorizations: {
            ...(admin.status === "active" ? { admin: admin.authorization } : {}),
            ...(judge.status === "active" ? { judge: judge.authorization } : {}),
          },
          authorizationStates: {
            admin: admin.status === "active" ? "active" : "none",
            judge: !context.eventId
              ? "unresolved"
              : judge.status === "active"
                ? "active"
                : judge.status === "revoked"
                  ? "revoked"
                  : "none",
          },
          roles: {
            isAdmin: admin.status === "active",
            isJudge: judge.status === "active",
          },
        },
      };
    } catch {
      return { status: "unavailable" };
    }
  };
}

export const resolveApplicationPrincipal = createApplicationPrincipalResolver(
  defaultDependencies,
);
