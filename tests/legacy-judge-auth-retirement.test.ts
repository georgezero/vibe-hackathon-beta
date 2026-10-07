import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (file: string) => readFileSync(join(root, file), "utf8");

describe("Phase B.4.6 legacy judge authentication retirement", () => {
  it("removes every executable legacy judge authentication entry point", () => {
    for (const file of [
      "app/api/judge/session/route.ts",
      "app/api/judge/logout/route.ts",
      "app/judge/JudgeLoginForm.tsx",
      "app/judge/logout/route.ts",
      "lib/judge-auth-mode.ts",
      "lib/judge-auth-store.ts",
      "lib/judge-session.ts",
    ]) {
      expect(existsSync(join(root, file)), file).toBe(false);
    }
  });

  it("has one Better Auth-backed page and API authorization path", () => {
    const pageGuard = source("lib/judge-page-auth.ts");
    const apiGuard = source("lib/judge-api.ts");
    for (const text of [pageGuard, apiGuard]) {
      expect(text).toContain("resolveJudgePrincipal");
      expect(text).not.toContain("vibe_judge_session");
      expect(text).not.toContain("judgeAuthMode");
      expect(text).not.toContain("verifyJudgeCredential");
    }
    expect(pageGuard).toContain('authentication: "better-auth"');
    expect(apiGuard).toContain('authentication: "better-auth"');
  });

  it("uses one shared sign-in card and one shared password form", () => {
    const admin = source("app/admin/page.tsx");
    const judge = source("app/judge/page.tsx");
    const login = source("app/login/page.tsx");
    const card = source("components/auth/InteractiveSignInCard.tsx");
    expect(login).toContain("AuthenticationIntro");
    expect(login).toContain("InteractiveSignInCard");
    expect(admin).not.toContain("Private administrator credential");
    expect(judge).not.toContain("Private judge credential");
    expect(card).toContain("PasswordSignInForm");
    expect(card).toContain("Continue with Viby");
  });

  it("uses one global application logout endpoint", () => {
    const nav = source("components/Nav.tsx");
    const logout = source("app/logout/route.ts");
    expect(nav.match(/action="\/logout"/g)).toHaveLength(2);
    expect(logout).toContain("applyApplicationLogout");
    expect(existsSync(join(root, "app/admin/logout/route.ts"))).toBe(false);
    expect(existsSync(join(root, "app/judge/logout/route.ts"))).toBe(false);
  });

  it("keeps the historical cookie name only as a defensive logout tombstone", () => {
    const logout = source("lib/application-logout.ts");
    expect(logout).toContain('"vibe_judge_session"');
    expect(logout).toContain("Security tombstone");
    for (const file of [
      "lib/judge-api.ts",
      "lib/judge-page-auth.ts",
      "app/judge/page.tsx",
    ]) {
      expect(source(file)).not.toContain("vibe_judge_session");
    }
  });

  it("does not retain legacy authentication flags in runtime configuration", () => {
    const configuration = [
      source(".env.example"),
      source("playwright.config.ts"),
      source("playwright.phase-b.config.ts"),
    ].join("\n");
    expect(configuration).not.toContain("VIBE_JUDGE_AUTH_MODE");
    expect(configuration).not.toContain("VIBE_JUDGE_SESSION_SECRET");
    expect(configuration).not.toContain("VIBE_JUDGE_SESSION_TTL_SECONDS");
  });
});
