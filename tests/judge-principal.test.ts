import { describe, expect, it, vi } from "vitest";
import {
  createJudgePrincipalResolver,
  type JudgePrincipalDependencies,
} from "@/lib/judge-principal";
import type {
  ApplicationPrincipal,
  ApplicationPrincipalResolution,
} from "@/lib/application-principal";

function applicationPrincipal(input: {
  admin?: boolean;
  judge?: boolean;
  judgeState?: "active" | "revoked" | "none";
  eventId?: string;
} = {}): ApplicationPrincipal {
  const activeJudge = input.judge
    ? {
      id: "authorization-1",
      status: "active" as const,
      userId: "user-1",
      judge: {
        id: "judge-1",
        name: "Judge One",
        email: "judge@example.test",
      },
      eventId: input.eventId ?? "evt_vibe_2025",
      grantProvenance: "operator_approved",
      acceptedAt: new Date(1),
    }
    : undefined;
  return {
    authenticationMechanism: "better-auth",
    user: {
      id: "user-1",
      name: "Judge Account",
      email: "account@example.test",
      image: null,
    },
    session: {
      id: "session-1",
      createdAt: new Date(1),
      expiresAt: new Date(Date.now() + 60_000),
    },
    account: {
      status: "active",
      passwordChangeRequired: false,
    },
    sessionProvenance: {
      authenticationMethod: "better_auth_session",
    },
    authorizations: {
      ...(input.admin
        ? {
          admin: {
            status: "active" as const,
            grantSource: "operator",
            createdAt: new Date(1),
            updatedAt: new Date(1),
          },
        }
        : {}),
      ...(activeJudge ? { judge: activeJudge } : {}),
    },
    authorizationStates: {
      admin: input.admin ? "active" : "none",
      judge: input.judgeState ?? (input.judge ? "active" : "none"),
    },
    roles: {
      isAdmin: Boolean(input.admin),
      isJudge: Boolean(input.judge),
    },
  };
}

function dependencies(
  resolution: ApplicationPrincipalResolution,
  event: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
  } | null = {
    id: "evt_vibe_2025",
    name: "Event",
    slug: "event",
    isActive: true,
  },
): JudgePrincipalDependencies {
  return {
    resolveApplication: vi.fn(async () => resolution),
    getEvent: vi.fn(async () => event as never),
  };
}

describe("Better Auth judge principal", () => {
  it("distinguishes signed out from authenticated but unauthorized", async () => {
    const signedOut = await createJudgePrincipalResolver(dependencies({
      status: "unauthenticated",
    }))(new Headers(), { eventId: "evt_vibe_2025" });
    expect(signedOut).toEqual({ status: "signed_out" });

    const noRole = await createJudgePrincipalResolver(dependencies({
      status: "authenticated",
      principal: applicationPrincipal(),
    }))(new Headers(), { eventId: "evt_vibe_2025" });
    expect(noRole).toEqual({
      status: "forbidden",
      reason: "not_authorized",
    });
  });

  it("returns the exact authorized judge profile and event", async () => {
    const resolution = await createJudgePrincipalResolver(dependencies({
      status: "authenticated",
      principal: applicationPrincipal({ judge: true }),
    }))(new Headers(), { eventId: "evt_vibe_2025" });

    expect(resolution.status).toBe("authorized");
    if (resolution.status !== "authorized") return;
    expect(resolution.principal.judgeProfile).toEqual({
      id: "judge-1",
      name: "Judge One",
      email: "judge@example.test",
    });
    expect(resolution.principal.judgeAuthorization.id).toBe("authorization-1");
    expect(resolution.principal.event.id).toBe("evt_vibe_2025");
  });

  it("denies revoked, wrong-event, missing-event, and inactive-event states", async () => {
    const revoked = await createJudgePrincipalResolver(dependencies({
      status: "authenticated",
      principal: applicationPrincipal({ judgeState: "revoked" }),
    }))(new Headers(), { eventId: "evt_vibe_2025" });
    expect(revoked).toEqual({ status: "forbidden", reason: "revoked" });

    const wrongEvent = await createJudgePrincipalResolver(dependencies({
      status: "authenticated",
      principal: applicationPrincipal({ judge: true, eventId: "event-other" }),
    }))(new Headers(), { eventId: "evt_vibe_2025" });
    expect(wrongEvent).toEqual({
      status: "forbidden",
      reason: "event_mismatch",
    });

    const missingContext = await createJudgePrincipalResolver(dependencies({
      status: "authenticated",
      principal: applicationPrincipal({ judge: true }),
    }))(new Headers(), { eventId: "" });
    expect(missingContext).toEqual({
      status: "forbidden",
      reason: "event_mismatch",
    });

    const inactiveEvent = await createJudgePrincipalResolver(dependencies({
      status: "authenticated",
      principal: applicationPrincipal({ judge: true }),
    }, {
      id: "evt_vibe_2025",
      name: "Event",
      slug: "event",
      isActive: false,
    }))(new Headers(), { eventId: "evt_vibe_2025" });
    expect(inactiveEvent).toEqual({
      status: "forbidden",
      reason: "event_mismatch",
    });
  });

  it("fails closed for conflicting or malformed application authorization", async () => {
    const conflict = await createJudgePrincipalResolver(dependencies({
      status: "forbidden",
      reason: "conflicting_judge_authorizations",
    }))(new Headers(), { eventId: "evt_vibe_2025" });
    expect(conflict).toEqual({
      status: "forbidden",
      reason: "conflicting_authorization",
    });

    const malformed = await createJudgePrincipalResolver(dependencies({
      status: "forbidden",
      reason: "malformed_session",
    }))(new Headers(), { eventId: "evt_vibe_2025" });
    expect(malformed).toEqual({
      status: "forbidden",
      reason: "malformed_authorization",
    });
  });

  it("keeps admin-only, judge-only, both-role, and neither-role states independent", async () => {
    const cases = [
      [applicationPrincipal({ admin: true }), "not_authorized"],
      [applicationPrincipal({ judge: true }), "authorized"],
      [applicationPrincipal({ admin: true, judge: true }), "authorized"],
      [applicationPrincipal(), "not_authorized"],
    ] as const;
    for (const [principal, expected] of cases) {
      const resolution = await createJudgePrincipalResolver(dependencies({
        status: "authenticated",
        principal,
      }))(new Headers(), { eventId: "evt_vibe_2025" });
      expect(resolution.status).toBe(
        expected === "authorized" ? "authorized" : "forbidden",
      );
      expect(principal.roles.isAdmin).toBe(Boolean(principal.authorizations.admin));
    }
  });

  it("does not inspect or accept a legacy judge cookie", async () => {
    const deps = dependencies({ status: "unauthenticated" });
    const resolution = await createJudgePrincipalResolver(deps)(
      new Headers({ cookie: "vibe_judge_session=legacy-value" }),
      { eventId: "evt_vibe_2025" },
    );
    expect(resolution).toEqual({ status: "signed_out" });
    expect(deps.resolveApplication).toHaveBeenCalledOnce();
  });
});
