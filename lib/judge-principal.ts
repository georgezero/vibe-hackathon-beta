import {
  resolveApplicationPrincipal,
  type ApplicationPrincipal,
  type ApplicationPrincipalResolution,
} from "@/lib/application-principal";
import { getJudgingEvent } from "@/lib/judging-event";
import type { ActiveJudgeAuthorization } from "@/lib/judge-authorizations";

export interface JudgePrincipal {
  applicationPrincipal: ApplicationPrincipal;
  judgeAuthorization: ActiveJudgeAuthorization;
  judgeProfile: {
    id: string;
    name: string;
    email: string;
  };
  event: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  };
}

export type JudgePrincipalResolution =
  | { status: "authorized"; principal: JudgePrincipal }
  | { status: "signed_out" }
  | {
    status: "forbidden";
    reason:
      | "not_authorized"
      | "revoked"
      | "event_mismatch"
      | "password_change_required"
      | "malformed_authorization"
      | "conflicting_authorization";
  }
  | { status: "unavailable" };

export interface JudgePrincipalDependencies {
  resolveApplication(
    headers: Headers,
    context: { eventId: string },
  ): Promise<ApplicationPrincipalResolution>;
  getEvent(eventId: string): ReturnType<typeof getJudgingEvent>;
}

const defaultDependencies: JudgePrincipalDependencies = {
  resolveApplication: resolveApplicationPrincipal,
  getEvent: getJudgingEvent,
};

export function createJudgePrincipalResolver(
  dependencies: JudgePrincipalDependencies,
) {
  return async function resolveJudge(
    headers: Headers,
    context: { eventId: string },
  ): Promise<JudgePrincipalResolution> {
    const eventId = context.eventId?.trim();
    if (!eventId) {
      return { status: "forbidden", reason: "event_mismatch" };
    }

    const application = await dependencies.resolveApplication(headers, { eventId });
    if (application.status === "unauthenticated") return { status: "signed_out" };
    if (application.status === "unavailable") return { status: "unavailable" };
    if (application.status === "forbidden") {
      return {
        status: "forbidden",
        reason: application.reason === "conflicting_judge_authorizations"
          ? "conflicting_authorization"
          : "malformed_authorization",
      };
    }
    if (application.principal.account.passwordChangeRequired) {
      return { status: "forbidden", reason: "password_change_required" };
    }

    const state = application.principal.authorizationStates.judge;
    if (state === "revoked") {
      return { status: "forbidden", reason: "revoked" };
    }
    const authorization = application.principal.authorizations.judge;
    if (!application.principal.roles.isJudge || !authorization) {
      return { status: "forbidden", reason: "not_authorized" };
    }
    if (authorization.eventId !== eventId) {
      return { status: "forbidden", reason: "event_mismatch" };
    }

    const event = await dependencies.getEvent(eventId);
    if (!event || !event.isActive) {
      return { status: "forbidden", reason: "event_mismatch" };
    }

    return {
      status: "authorized",
      principal: {
        applicationPrincipal: application.principal,
        judgeAuthorization: authorization,
        judgeProfile: authorization.judge,
        event: {
          id: event.id,
          name: event.name,
          slug: event.slug,
          isActive: Boolean(event.isActive),
        },
      },
    };
  };
}

export const resolveJudgePrincipal = createJudgePrincipalResolver(
  defaultDependencies,
);
