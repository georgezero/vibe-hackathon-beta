import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (file: string) =>
  readFileSync(join(process.cwd(), file), "utf8");

describe("B.4.3 judge guard boundaries", () => {
  it("resolves unified judge identity only through the shared application principal", () => {
    const principal = source("lib/judge-principal.ts");
    expect(principal).toContain("resolveApplicationPrincipal");
    expect(principal).not.toContain("vibe_judge_session");
    expect(principal).not.toContain("judge.token");
    expect(principal).not.toContain("Better Auth email");
  });

  it("migrates all protected judge pages through the central page guard", () => {
    for (const file of [
      "app/judge/dashboard/page.tsx",
      "app/judge/submissions/[submissionId]/page.tsx",
      "app/judge/submissions/[submissionId]/ai/page.tsx",
    ]) {
      expect(source(file), file).toContain("requireAuthorizedJudgePage");
    }
    expect(source("lib/judge-page-auth.ts")).toContain("resolveJudgePrincipal");
  });

  it("migrates protected APIs through the central Better Auth API guard", () => {
    const wrapper = source("lib/judge-api.ts");
    expect(wrapper).toContain("resolveJudgePrincipal");
    expect(wrapper).not.toContain("judgeAuthMode");
    expect(wrapper).not.toContain("vibe_judge_session");
    for (const file of [
      "app/api/judge/data/route.ts",
      "app/api/scores/route.ts",
    ]) {
      expect(source(file), file).toContain("withJudgeApi");
    }
  });

  it("preserves assignment, score ownership, origin, and freeze checks", () => {
    const scores = source("app/api/scores/route.ts");
    const wrapper = source("lib/judge-api.ts");
    expect(scores).toContain("assertEventNotFrozen");
    expect(scores).toContain("judgeAssignments.judgeId");
    expect(scores).toContain("humanScores.judgeId");
    expect(scores).toContain("judge.id");
    expect(wrapper).toContain("strictSameOriginFailure");
  });

  it("adds role-neutral Viby judge login without inferring a user from email", () => {
    const page = source("app/login/page.tsx");
    const card = source("components/auth/InteractiveSignInCard.tsx");
    const principal = source("lib/judge-principal.ts");
    expect(page).toContain('flow="application"');
    expect(card).toContain("Continue with Viby");
    expect(principal).not.toContain("viby");
    expect(principal).not.toContain(".email ===");
  });

  it("removes the legacy credential path and presents one shared sign-in system", () => {
    const page = source("app/login/page.tsx");
    const judge = source("app/judge/page.tsx");
    expect(page).toContain("InteractiveSignInCard");
    expect(judge).not.toContain("Private judge credential");
    expect(judge).not.toContain("allowsLegacyJudgeCredential");
    expect(() => source("lib/judge-auth-mode.ts")).toThrow();
  });
});
