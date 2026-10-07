import { describe, expect, it, vi } from "vitest";
import {
  createApplicationPrincipalResolver,
  type AdminAuthorizationResolution,
  type ApplicationPrincipalDependencies,
} from "@/lib/application-principal";
import type { JudgeAuthorizationResolution } from "@/lib/judge-authorizations";
import type {
  InteractiveSessionProvenanceResolution,
} from "@/lib/interactive-session-provenance";

const absentProvenance: InteractiveSessionProvenanceResolution = { status: "absent" };
const noAdmin: AdminAuthorizationResolution = { status: "none" };
const noJudge: JudgeAuthorizationResolution = { status: "none" };

function dependencies(
  overrides: Partial<ApplicationPrincipalDependencies> = {},
): ApplicationPrincipalDependencies {
  return {
    getSession: vi.fn(async () => ({
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.test",
        image: null,
      },
      session: {
        id: "session-1",
        createdAt: new Date(Date.now() - 1_000),
        expiresAt: new Date(Date.now() + 60_000),
      },
    })),
    getSessionProvenance: vi.fn(async () => absentProvenance),
    getAdminAuthorization: vi.fn(async () => noAdmin),
    getJudgeAuthorization: vi.fn(async () => noJudge),
    ...overrides,
  };
}

const activeJudge = {
  status: "active" as const,
  authorization: {
    id: "judge-authorization-1",
    status: "active" as const,
    userId: "user-1",
    judge: { id: "judge-1", name: "Judge", email: "judge@example.test" },
    eventId: "event-1",
    grantProvenance: "operator",
    acceptedAt: new Date(1),
  },
};

describe("event-scoped application principal", () => {
  it("does not resolve judge state without explicit event context", async () => {
    const deps = dependencies({
      getJudgeAuthorization: vi.fn(async () => activeJudge),
    });
    const resolution = await createApplicationPrincipalResolver(deps)(new Headers());
    expect(resolution.status).toBe("authenticated");
    if (resolution.status !== "authenticated") return;
    expect(resolution.principal.roles.isJudge).toBe(false);
    expect(deps.getJudgeAuthorization).not.toHaveBeenCalled();
  });

  it("sets the judge role only for an active exact-event authorization", async () => {
    const deps = dependencies({
      getJudgeAuthorization: vi.fn(
        async (_userId, eventId): Promise<JudgeAuthorizationResolution> =>
          eventId === "event-1" ? activeJudge : noJudge,
      ),
    });
    const resolver = createApplicationPrincipalResolver(deps);
    const active = await resolver(new Headers(), { eventId: "event-1" });
    expect(active.status).toBe("authenticated");
    if (active.status === "authenticated") {
      expect(active.principal.roles).toEqual({ isAdmin: false, isJudge: true });
      expect(active.principal.authorizations.judge?.judge.id).toBe("judge-1");
    }
    const wrongEvent = await resolver(new Headers(), { eventId: "event-2" });
    expect(wrongEvent.status).toBe("authenticated");
    if (wrongEvent.status === "authenticated") {
      expect(wrongEvent.principal.roles.isJudge).toBe(false);
    }
  });

  it("keeps administrator and judge authorization independent", async () => {
    const adminOnly = await createApplicationPrincipalResolver(dependencies({
      getAdminAuthorization: vi.fn(
        async (): Promise<AdminAuthorizationResolution> => ({
          status: "active",
          authorization: {
            status: "active",
            grantSource: "operator",
            createdAt: new Date(1),
            updatedAt: new Date(1),
          },
        }),
      ),
    }))(new Headers(), { eventId: "event-1" });
    expect(adminOnly.status).toBe("authenticated");
    if (adminOnly.status === "authenticated") {
      expect(adminOnly.principal.roles).toEqual({ isAdmin: true, isJudge: false });
    }

    const judgeOnly = await createApplicationPrincipalResolver(dependencies({
      getJudgeAuthorization: vi.fn(async () => activeJudge),
    }))(new Headers(), { eventId: "event-1" });
    expect(judgeOnly.status).toBe("authenticated");
    if (judgeOnly.status === "authenticated") {
      expect(judgeOnly.principal.roles).toEqual({ isAdmin: false, isJudge: true });
    }
  });

  it("fails closed on ambiguous judge authorization", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies({
      getJudgeAuthorization: vi.fn(
        async (): Promise<JudgeAuthorizationResolution> => ({ status: "conflict" }),
      ),
    }))(new Headers(), { eventId: "event-1" });
    expect(resolution).toEqual({
      status: "forbidden",
      reason: "conflicting_judge_authorizations",
    });
  });

  it("does not derive a role from historical judge credentials", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies())(
      new Headers({ cookie: "vibe_judge_session=legacy; judge_token=private" }),
      { eventId: "event-1" },
    );
    expect(resolution.status).toBe("authenticated");
    if (resolution.status !== "authenticated") return;
    expect(resolution.principal.roles).toEqual({ isAdmin: false, isJudge: false });
  });
});
