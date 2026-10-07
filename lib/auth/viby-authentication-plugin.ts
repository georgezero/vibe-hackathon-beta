import type { BetterAuthPlugin } from "better-auth";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import {
  consumeVibySessionHandoff,
  VIBY_HANDOFF_COOKIE,
} from "@/lib/viby-login-transactions";
import { recordInteractiveSessionProvenance } from "@/lib/interactive-session-provenance";
import { logJudgeAudit } from "@/lib/judge-audit";
import { logApplicationAudit } from "@/lib/application-audit";
import { ACCOUNT_INVITATION_COOKIE } from "@/lib/account-invitations";

export const QUALIFIED_BETTER_AUTH_VERSION = "1.6.25";

export function assertVibyBetterAuthCompatibility(context: {
  internalAdapter?: {
    createSession?: unknown;
    findUserById?: unknown;
    deleteSession?: unknown;
  };
}, installedVersion?: string, cookieHelper: unknown = setSessionCookie) {
  const packagePath = join(process.cwd(), "node_modules", "better-auth", "package.json");
  const installed = installedVersion ?? (JSON.parse(readFileSync(packagePath, "utf8")) as { version?: string }).version;
  if (installed !== QUALIFIED_BETTER_AUTH_VERSION) {
    throw new Error(`Viby authentication requires Better Auth ${QUALIFIED_BETTER_AUTH_VERSION}; found ${installed ?? "unknown"}.`);
  }
  for (const method of ["createSession", "findUserById", "deleteSession"] as const) {
    if (typeof context.internalAdapter?.[method] !== "function") {
      throw new Error(`Viby authentication compatibility failure: internalAdapter.${method} is unavailable.`);
    }
  }
  if (typeof cookieHelper !== "function") {
    throw new Error("Viby authentication compatibility failure: setSessionCookie is unavailable.");
  }
}

function cookieValue(headers: Headers, name: string) {
  const cookie = headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * The sole, version-pinned Better Auth compatibility boundary for Viby.
 * This mirrors Better Auth authentication plugins: its endpoint context creates
 * the session and the exported helper emits the normal Better Auth cookie.
 */
export function vibyAuthenticationPlugin(): BetterAuthPlugin {
  return {
    id: "viby-authentication",
    version: "1.0.0",
    init(ctx) {
      assertVibyBetterAuthCompatibility(ctx);
    },
    endpoints: {
      completeVibyAuthentication: createAuthEndpoint(
        "/viby/complete",
        { method: "GET", requireHeaders: true },
        async (ctx) => {
          const handoffToken = cookieValue(ctx.headers, VIBY_HANDOFF_COOKIE);
          if (!handoffToken) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: "The Viby login handoff is missing or expired.",
            });
          }
          const resolved = await consumeVibySessionHandoff(handoffToken);
          if (!resolved) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: "The Viby login handoff is invalid or has already been used.",
            });
          }
          const user = await ctx.context.internalAdapter.findUserById(resolved.handoff.userId);
          if (!user || user.id !== resolved.user.id) {
            throw APIError.fromStatus("UNAUTHORIZED", {
              message: "The linked application account is unavailable.",
            });
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          try {
            await recordInteractiveSessionProvenance({
              sessionId: session.id,
              identityLinkId: resolved.link.id,
              vibySubjectHash: resolved.handoff.vibySubjectHash,
              operation: resolved.handoff.operation,
              verificationKind: resolved.handoff.verificationKind,
              verifiedAt: resolved.handoff.verifiedAt,
            });
          } catch (error) {
            await ctx.context.internalAdapter.deleteSession(session.token);
            throw error;
          }

          await setSessionCookie(ctx, { session, user });
          if (resolved.handoff.operation === "judge_login") {
            await logJudgeAudit("judge_viby_login_succeeded", {
              userId: user.id,
              route: resolved.handoff.returnTo,
              reason: resolved.handoff.verificationKind,
            });
            if (resolved.handoff.verificationKind === "remembered") {
              await logJudgeAudit("judge_viby_remembered_login", {
                userId: user.id,
                route: resolved.handoff.returnTo,
              });
            }
          } else if (resolved.handoff.operation === "application_login") {
            await logApplicationAudit("application_viby_login_succeeded", {
              route: resolved.handoff.returnTo,
              reason: resolved.handoff.verificationKind,
            });
          }
          for (const name of [VIBY_HANDOFF_COOKIE, ADMIN_SESSION_COOKIE, ACCOUNT_INVITATION_COOKIE]) {
            ctx.setCookie(name, "", {
              httpOnly: true,
              sameSite: "lax",
              secure: ctx.context.options.advanced?.useSecureCookies === true,
              path: "/",
              maxAge: 0,
            });
          }
          throw ctx.redirect(resolved.handoff.returnTo);
        },
      ),
    },
  };
}
