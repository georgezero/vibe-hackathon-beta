import { describe, expect, it, vi } from "vitest";
import {
  createApplicationPrincipalResolver,
  type AdminAuthorizationResolution,
  type ApplicationPrincipalDependencies,
} from "@/lib/application-principal";
import type {
  InteractiveSessionProvenanceResolution,
} from "@/lib/interactive-session-provenance";
import type { AccountControlResolution } from "@/lib/account-controls";

function session() {
  return {
    user: {
      id: "user-1",
      name: "George One",
      email: "george@example.test",
      image: null,
    },
    session: {
      id: "session-1",
      createdAt: new Date(Date.now() - 1_000),
      expiresAt: new Date(Date.now() + 60_000),
    },
  };
}

const absentProvenance: InteractiveSessionProvenanceResolution = {
  status: "absent",
};
const noAdmin: AdminAuthorizationResolution = { status: "none" };
const activeAdmin: AdminAuthorizationResolution = {
  status: "active",
  authorization: {
    status: "active",
    grantSource: "operator",
    createdAt: new Date(1),
    updatedAt: new Date(1),
  },
};
const disabledAccount: AccountControlResolution = {
  status: "valid",
  control: {
    status: "disabled",
    passwordChangeRequired: false,
    temporaryPasswordIssuedAt: null,
    passwordChangedAt: null,
    disabledAt: new Date(),
  },
};
const invalidAccount: AccountControlResolution = { status: "invalid" };
const passwordChangeAccount: AccountControlResolution = {
  status: "valid",
  control: {
    status: "active",
    passwordChangeRequired: true,
    temporaryPasswordIssuedAt: new Date(),
    passwordChangedAt: null,
    disabledAt: null,
  },
};

function dependencies(overrides: Partial<ApplicationPrincipalDependencies> = {}) {
  return {
    getSession: vi.fn(async () => session()),
    getSessionProvenance: vi.fn(async () => absentProvenance),
    getAdminAuthorization: vi.fn(async () => noAdmin),
    ...overrides,
  } satisfies ApplicationPrincipalDependencies;
}

describe("role-neutral application principal", () => {
  it("returns no principal and performs no authorization lookups when signed out", async () => {
    const deps = dependencies({
      getSession: vi.fn(async () => null),
    });
    const resolution = await createApplicationPrincipalResolver(deps)(new Headers());
    expect(resolution).toEqual({ status: "unauthenticated" });
    expect(deps.getSessionProvenance).not.toHaveBeenCalled();
    expect(deps.getAdminAuthorization).not.toHaveBeenCalled();
  });

  it("represents an authenticated user with no grant as unauthorized", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies())(new Headers());
    expect(resolution.status).toBe("authenticated");
    if (resolution.status !== "authenticated") return;
    expect(resolution.principal.roles).toEqual({ isAdmin: false, isJudge: false });
    expect(resolution.principal.authorizations).toEqual({});
    expect(resolution.principal.sessionProvenance.authenticationMethod)
      .toBe("better_auth_session");
  });

  it("fails closed for disabled or malformed account lifecycle state", async () => {
    const disabled = await createApplicationPrincipalResolver(dependencies({
      getAccountControl: vi.fn(async () => disabledAccount),
    }))(new Headers());
    expect(disabled).toEqual({ status: "forbidden", reason: "disabled_account" });

    const malformed = await createApplicationPrincipalResolver(dependencies({
      getAccountControl: vi.fn(async () => invalidAccount),
    }))(new Headers());
    expect(malformed).toEqual({
      status: "forbidden",
      reason: "malformed_account_state",
    });
  });

  it("carries password-change policy without deriving a role", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies({
      getAccountControl: vi.fn(async () => passwordChangeAccount),
    }))(new Headers());
    expect(resolution.status).toBe("authenticated");
    if (resolution.status !== "authenticated") return;
    expect(resolution.principal.account.passwordChangeRequired).toBe(true);
    expect(resolution.principal.roles).toEqual({ isAdmin: false, isJudge: false });
  });

  it("derives the admin role only from one active live authorization", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies({
      getAdminAuthorization: vi.fn(async () => activeAdmin),
    }))(new Headers());
    expect(resolution.status).toBe("authenticated");
    if (resolution.status !== "authenticated") return;
    expect(resolution.principal.roles).toEqual({ isAdmin: true, isJudge: false });
    expect(resolution.principal.authorizations.admin).toEqual(activeAdmin.authorization);
  });

  it("treats revoked or inactive authorization as no role", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies({
      getAdminAuthorization: vi.fn(
        async (): Promise<AdminAuthorizationResolution> => ({ status: "none" }),
      ),
    }))(new Headers());
    expect(resolution.status).toBe("authenticated");
    if (resolution.status !== "authenticated") return;
    expect(resolution.principal.roles.isAdmin).toBe(false);
  });

  it("fails closed when active admin authorization is ambiguous", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies({
      getAdminAuthorization: vi.fn(
        async (): Promise<AdminAuthorizationResolution> => ({ status: "conflict" }),
      ),
    }))(new Headers());
    expect(resolution).toEqual({
      status: "forbidden",
      reason: "conflicting_admin_authorizations",
    });
  });

  it("reports Viby-backed provenance without granting a role", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies({
      getSessionProvenance: vi.fn(
        async (): Promise<InteractiveSessionProvenanceResolution> => ({
          status: "valid",
          provenance: {
            authenticationMethod: "better_auth_viby",
            operation: "admin_login",
            verificationKind: "fresh",
            verifiedAt: new Date(),
            linkedRuntimeIdentity: {
              provider: "viby",
              displayName: "George One",
              status: "active",
              revokedAt: null,
            },
          },
        }),
      ),
    }))(new Headers());
    expect(resolution.status).toBe("authenticated");
    if (resolution.status !== "authenticated") return;
    expect(resolution.principal.sessionProvenance.authenticationMethod)
      .toBe("better_auth_viby");
    expect(resolution.principal.linkedRuntimeIdentity).toEqual({
      provider: "viby",
      displayName: "George One",
    });
    expect(resolution.principal.roles.isAdmin).toBe(false);
  });

  it("keeps provider-neutral and missing provenance non-authoritative", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies())(new Headers());
    expect(resolution.status).toBe("authenticated");
    if (resolution.status !== "authenticated") return;
    expect(resolution.principal.sessionProvenance.authenticationMethod)
      .toBe("better_auth_session");
    expect(resolution.principal.roles.isAdmin).toBe(false);
  });

  it("rejects malformed provenance and revoked linked Runtime identity", async () => {
    const malformed = await createApplicationPrincipalResolver(dependencies({
      getSessionProvenance: vi.fn(
        async (): Promise<InteractiveSessionProvenanceResolution> => ({
          status: "invalid",
        }),
      ),
    }))(new Headers());
    expect(malformed).toEqual({
      status: "forbidden",
      reason: "malformed_session_provenance",
    });

    const revoked = await createApplicationPrincipalResolver(dependencies({
      getSessionProvenance: vi.fn(
        async (): Promise<InteractiveSessionProvenanceResolution> => ({
          status: "valid",
          provenance: {
            authenticationMethod: "better_auth_viby",
            operation: "admin_login",
            verificationKind: "fresh",
            verifiedAt: new Date(),
            linkedRuntimeIdentity: {
              provider: "viby",
              displayName: "George One",
              status: "revoked",
              revokedAt: new Date(),
            },
          },
        }),
      ),
      getAdminAuthorization: vi.fn(async () => activeAdmin),
    }))(new Headers());
    expect(revoked).toEqual({
      status: "forbidden",
      reason: "revoked_runtime_identity",
    });
  });

  it("does not accept historical identity-link roles as authorization", async () => {
    const resolution = await createApplicationPrincipalResolver(dependencies({
      getSessionProvenance: vi.fn(
        async (): Promise<InteractiveSessionProvenanceResolution> => ({
          status: "valid",
          provenance: {
            authenticationMethod: "better_auth_viby",
            operation: "admin_login",
            verificationKind: "fresh",
            verifiedAt: new Date(),
            linkedRuntimeIdentity: {
              provider: "viby",
              displayName: "Historical Admin",
              status: "active",
              revokedAt: null,
            },
          },
        }),
      ),
      getAdminAuthorization: vi.fn(async () => noAdmin),
    }))(new Headers());
    expect(resolution.status).toBe("authenticated");
    if (resolution.status !== "authenticated") return;
    expect(resolution.principal.roles.isAdmin).toBe(false);
    expect(resolution.principal.authorizations.admin).toBeUndefined();
  });

  it("ignores the legacy judge cookie completely", async () => {
    const deps = dependencies({
      getSession: vi.fn(async () => null),
    });
    const resolution = await createApplicationPrincipalResolver(deps)(
      new Headers({ cookie: "vibe_judge_session=signed-legacy-value" }),
    );
    expect(resolution).toEqual({ status: "unauthenticated" });
    expect(deps.getAdminAuthorization).not.toHaveBeenCalled();
  });
});
