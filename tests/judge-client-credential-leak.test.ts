import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(relative: string) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

describe("judge credential client exposure", () => {
  it("does not serialize judge credentials into login or admin client props", () => {
    const loginPage = read("app/judge/page.tsx");
    const loginClient = read("components/auth/PasswordSignInForm.tsx");
    const adminPage = read("app/admin/dashboard/[[...tab]]/page.tsx");
    const adminClient = read("app/admin/dashboard/AdminDashboardClient.tsx");

    expect(loginPage).not.toContain("judges.token");
    expect(loginPage).not.toContain("demoJudges");
    expect(loginClient).not.toContain("demoJudges");
    expect(loginClient).not.toContain(".some((j)");
    expect(loginClient).toContain('type="password"');
    expect(fs.existsSync(path.join(ROOT, "app/judge/JudgeLoginForm.tsx"))).toBe(false);
    expect(adminPage).not.toContain("token: j.token");
    expect(adminClient).not.toContain("judge.token");
    expect(read("app/judge/dashboard/page.tsx")).toContain(
      'export const dynamic = "force-dynamic"',
    );
  });

  it("uses cookie-authenticated routes instead of token URLs or bearer headers", () => {
    const judgeFiles = [
      "components/auth/PasswordSignInForm.tsx",
      "app/judge/dashboard/page.tsx",
      "app/judge/dashboard/JudgeDashboardShortcuts.tsx",
      "app/judge/submissions/[submissionId]/page.tsx",
      "app/judge/submissions/[submissionId]/ScoringClient.tsx",
      "app/judge/submissions/[submissionId]/ai/page.tsx",
      "components/Nav.tsx",
    ].map(read).join("\n");

    expect(judgeFiles).not.toContain("judgeToken");
    expect(judgeFiles).not.toMatch(/Authorization.*Bearer/);
    expect(judgeFiles).not.toMatch(/\/judge\/\$\{token\}/);
    expect(judgeFiles).not.toContain("NEXT_PUBLIC");
  });

  it("keeps judge auth variables out of public environment names", () => {
    const sourceFiles = [
      ".env.example",
      "lib/judge-api.ts",
    ].map(read).join("\n");

    expect(sourceFiles).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*JUDGE/);
  });

  it("does not seed or log reusable literal judge credentials", () => {
    const seedFiles = [
      "lib/mock-data.ts",
      "lib/db/seed.ts",
      "lib/db/seed-mixed.ts",
      "lib/db/seed-sim.ts",
      "lib/db/seed-media.ts",
    ].map(read).join("\n");

    expect(seedFiles).not.toMatch(/token:\s*"judge_[^"]+"/i);
    expect(seedFiles).not.toContain("token: judge.token");
    expect(seedFiles).not.toMatch(/console\.log\([^)]*judge\.token/);
  });
});
