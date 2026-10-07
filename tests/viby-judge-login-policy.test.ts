import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  VIBY_RUNTIME_CALLBACK_PATH,
  VIBY_RUNTIME_MODE,
  VIBY_RUNTIME_SOURCE,
  safeVibyReturnTo,
  vibyLoginPolicy,
} from "../lib/viby-login-policy";
import { hasCurrentFreshVibyEvidence } from "../lib/viby";
import { classifyVibyIdentityRows } from "../lib/viby-interactive-linking";

describe("B.4.4 role-neutral Viby judge policy", () => {
  it("requires fresh Viby verification for signed-out protected login", () => {
    expect(vibyLoginPolicy("admin_login")).toMatchObject({
      routineFreshnessRequired: true,
      rememberedLoginAllowed: false,
      defaultReturnTo: "/admin/dashboard",
    });
    expect(vibyLoginPolicy("judge_login")).toMatchObject({
      routineFreshnessRequired: true,
      rememberedLoginAllowed: false,
      defaultReturnTo: "/judge/dashboard",
      runtimeMode: "admin",
    });
  });

  it("uses the one production-registered Runtime contract for both operations", () => {
    expect(VIBY_RUNTIME_CALLBACK_PATH).toBe("/admin/viby/callback");
    expect(VIBY_RUNTIME_MODE).toBe("admin");
    expect(VIBY_RUNTIME_SOURCE).toBe("vibe_admin_confirmation");
    for (const operation of ["admin_login", "judge_login"] as const) {
      expect(vibyLoginPolicy(operation)).toMatchObject({
        callbackPath: VIBY_RUNTIME_CALLBACK_PATH,
        runtimeMode: VIBY_RUNTIME_MODE,
        source: VIBY_RUNTIME_SOURCE,
      });
    }
    const launch = readFileSync("app/api/viby/start/route.ts", "utf8");
    expect(launch).not.toContain("/judge/viby/callback");
    expect(launch).not.toContain("vibe_judge_login");
  });

  it("allow-lists destinations by operation", () => {
    expect(safeVibyReturnTo("admin_login", "/account")).toBe("/account");
    expect(safeVibyReturnTo("judge_login", "/account")).toBe("/account");
    expect(safeVibyReturnTo("admin_login", "/account-impersonator"))
      .toBe("/admin/dashboard");
    expect(safeVibyReturnTo("judge_login", "/account/impersonator"))
      .toBe("/judge/dashboard");
    expect(safeVibyReturnTo("judge_login", "/judge/submissions/one"))
      .toBe("/judge/submissions/one");
    expect(safeVibyReturnTo("judge_login", "/admin/dashboard"))
      .toBe("/judge/dashboard");
    expect(safeVibyReturnTo("admin_login", "/judge/dashboard"))
      .toBe("/admin/dashboard");
    expect(safeVibyReturnTo("judge_login", "//attacker.example"))
      .toBe("/judge/dashboard");
    expect(safeVibyReturnTo("judge_login", "/judge-impersonator"))
      .toBe("/judge/dashboard");
  });

  it("recognizes only current authoritative fresh evidence for link creation", () => {
    const now = Date.now();
    expect(hasCurrentFreshVibyEvidence({
      freshVerification: true,
      verificationKind: "fresh",
      verifiedAt: new Date(now - 60_000).toISOString(),
    }, now)).toBe(true);
    expect(hasCurrentFreshVibyEvidence({
      freshVerification: false,
      verificationKind: "remembered",
      verifiedAt: new Date(now).toISOString(),
    }, now)).toBe(false);
    expect(hasCurrentFreshVibyEvidence({
      freshVerification: true,
      verificationKind: "fresh",
      verifiedAt: new Date(now - 10 * 60_000).toISOString(),
    }, now)).toBe(false);
  });

  it("treats historical admin role as non-authoritative link compatibility", () => {
    const now = new Date();
    const result = classifyVibyIdentityRows([{
      id: "link",
      providerId: "viby",
      subjectId: "subject",
      role: "admin",
      linkScope: "legacy_admin",
      localUserId: "user",
      applicationId: "vibe-hackathon",
      status: "active",
      linkProvenance: "operator",
      environment: "https://app.example",
      bindingProvenance: null,
      boundAt: null,
      displayName: "Historical",
      lastVerifiedAt: now,
      lastAuthenticatedAt: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    }], {
      subject: "subject",
      applicationId: "vibe-hackathon",
      environment: "https://app.example",
    });
    expect(result.kind).toBe("bound_active");
  });

  it("keeps assignment, score, same-origin, freeze and judge authorization guards intact", () => {
    const source = (path: string) => readFileSync(path, "utf8");
    expect(source("lib/viby-unified-callback.ts")).toContain("createVibySessionHandoff");
    expect(source("lib/viby-unified-callback.ts")).not.toContain("judgeAuthorizations");
    expect(source("lib/viby-unified-callback.ts")).not.toContain(".email");
    expect(source("app/api/scores/route.ts")).toContain("assertEventNotFrozen");
    expect(source("app/api/scores/route.ts")).toContain("judgeAssignments.judgeId");
    expect(source("app/api/scores/route.ts")).toContain("humanScores.judgeId");
    expect(source("lib/judge-api.ts")).toContain("strictSameOriginFailure");
  });

  it("keeps operation and account locks at every transaction boundary", () => {
    const transactions = readFileSync("lib/viby-login-transactions.ts", "utf8");
    const linking = readFileSync("lib/viby-interactive-linking.ts", "utf8");
    expect(transactions).toContain("isVibyLoginOperation(rows[0].operation)");
    expect(transactions).not.toContain("eq(vibyLoginTransactions.operation, operation)");
    expect(linking).toContain("eq(vibyIdentityLinkTransactions.operation, operation)");
    expect(linking).toContain("eq(vibyIdentityLinkTransactions.expectedUserId, input.userId)");
    expect(linking).toContain("failureCode: \"account_changed\"");
  });

  it("keeps account-switch freshness in a dedicated server-owned route", () => {
    const routine = readFileSync("app/api/viby/start/route.ts", "utf8");
    const switchRoute = readFileSync("app/judge/switch-account/route.ts", "utf8");
    const start = readFileSync("lib/judge-viby-start.ts", "utf8");
    const callback = readFileSync("lib/viby-unified-callback.ts", "utf8");
    expect(routine).not.toContain('searchParams.get("link")');
    expect(switchRoute).toContain("freshnessRequired: true");
    expect(switchRoute).toContain('reason: "account_switch"');
    expect(switchRoute).toContain("beginFreshVibySignIn");
    expect(start).toContain("createVibyLoginTransaction");
    expect(start).toContain("VIBY_RUNTIME_CALLBACK_PATH");
    expect(callback).toContain('reason: "fresh_link_step_up"');
    expect(callback).not.toContain('searchParams.set("link"');
  });

  it("separates fresh sign-in from authenticated identity linking", () => {
    const launch = readFileSync("app/api/viby/start/route.ts", "utf8");
    const linking = readFileSync("app/api/viby/link/route.ts", "utf8");
    const account = readFileSync("app/account/AccountSettingsClient.tsx", "utf8");
    expect(launch).toContain("beginFreshVibySignIn");
    expect(linking).toContain("resolveApplicationPrincipal");
    expect(linking).not.toContain("beginFreshVibySignIn");
    expect(linking).toContain('returnTo: "/account"');
    expect(account).toContain('action="/api/viby/link"');
  });
});
