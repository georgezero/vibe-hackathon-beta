import { describe, expect, it } from "vitest";
import { applicationHeaderAccount } from "@/lib/application-account-display";
import { adminSessionCaption } from "@/lib/admin-identity-display";
import type { AdminPrincipal } from "@/lib/admin-principal";

function principal(overrides: Partial<AdminPrincipal> = {}): AdminPrincipal {
  return {
    authentication_mechanism: "better-auth",
    local_user_id: "user-1",
    viby_user_id: null,
    display_name: "George One",
    role: "admin",
    authorization_source: "admin_authorization",
    audit_id: "audit",
    issued_at: 1,
    expires_at: 2,
    identity_method: "better_auth_session",
    identity_confidence: null,
    ...overrides,
  };
}

describe("administrator identity display", () => {
  it("truthfully distinguishes Viby-backed, neutral Better Auth, and legacy sessions", () => {
    expect(adminSessionCaption(principal({
      identity_method: "better_auth_viby",
    }))).toBe("Confirmed with Viby · Better Auth session");
    expect(adminSessionCaption(principal())).toBe("Signed in with Better Auth");
    expect(adminSessionCaption(principal({
      authentication_mechanism: "viby",
      local_user_id: null,
      viby_user_id: "subject-1",
      identity_method: "face_identify",
    }))).toBe("Confirmed with Viby · Legacy application session");
  });

  it("exposes only sanitized account context to the global navigation", () => {
    expect(applicationHeaderAccount(principal({
      identity_method: "better_auth_viby",
    }))).toEqual({
      displayName: "George One",
    });
  });
});
