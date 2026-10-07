import { describe, expect, it } from "vitest";
import {
  destinationAuthorized,
  landingForPrincipal,
  loginContext,
  roleLanding,
  safeLoginReturnTo,
} from "@/lib/login-routing";
import { vibyLoginPolicy } from "@/lib/viby-login-policy";

function principal(isAdmin: boolean, isJudge: boolean) {
  return { roles: { isAdmin, isJudge } } as never;
}

describe("generic login routing", () => {
  it("accepts only internal protected destinations", () => {
    expect(safeLoginReturnTo("/admin/dashboard")).toBe("/admin/dashboard");
    expect(safeLoginReturnTo("/judge/dashboard?tab=assigned")).toBe("/judge/dashboard?tab=assigned");
    expect(safeLoginReturnTo("/judge/projects/sub_123/evaluation")).toBe("/judge/projects/sub_123/evaluation");
    expect(safeLoginReturnTo("https://attacker.example/login")).toBeNull();
    expect(safeLoginReturnTo("//attacker.example/login")).toBeNull();
    expect(safeLoginReturnTo("/unknown")).toBeNull();
  });

  it("describes protected-route context without exposing roles in generic copy", () => {
    expect(loginContext("/admin/dashboard")).toContain("administrator dashboard");
    expect(loginContext("/judge/dashboard")).toContain("continue judging");
    expect(loginContext("/judge/projects/sub_123")).toContain("continue judging");
    expect(loginContext("/account")).toContain("manage your account");
    expect(loginContext(null)).toBeNull();
  });

  it("lands single-role users in their role destination and others in account", () => {
    expect(roleLanding(principal(true, false))).toBe("/admin/dashboard");
    expect(roleLanding(principal(false, true))).toBe("/judge/dashboard");
    expect(roleLanding(principal(true, true))).toBe("/account/projects");
    expect(roleLanding(principal(false, false))).toBe("/account/projects");
  });

  it("only honors a return destination when the live role permits it", () => {
    expect(destinationAuthorized(principal(true, false), "/admin/dashboard")).toBe(true);
    expect(destinationAuthorized(principal(true, false), "/judge/dashboard")).toBe(false);
    expect(destinationAuthorized(principal(false, true), "/admin/dashboard")).toBe(false);
    expect(landingForPrincipal(principal(true, false), "/judge/dashboard")).toBe("/admin/dashboard");
    expect(landingForPrincipal(principal(true, false), "/admin/dashboard")).toBe("/admin/dashboard");
  });
});

describe("role-neutral Viby login operation", () => {
  it("uses the registered Runtime contract and requires fresh routine verification", () => {
    expect(vibyLoginPolicy("application_login")).toMatchObject({
      operation: "application_login",
      callbackPath: "/admin/viby/callback",
      runtimeMode: "admin",
      source: "vibe_admin_confirmation",
      routineFreshnessRequired: true,
      rememberedLoginAllowed: false,
      authorization: "none",
    });
  });
});
