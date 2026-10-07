import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { safeLoginReturnTo } from "@/lib/login-routing";

describe("submission-first onboarding boundaries", () => {
  it("allowlists claim confirmation and My Projects return destinations", () => {
    expect(safeLoginReturnTo("/claim/confirm")).toBe("/claim/confirm");
    expect(safeLoginReturnTo("/account/projects")).toBe("/account/projects");
    expect(safeLoginReturnTo("https://example.com/account/projects")).toBeNull();
  });

  it("keeps the legacy submit entry as a compatibility redirect", () => {
    const source = readFileSync("app/submit/page.tsx", "utf8");
    expect(source).toContain('redirect("/start")');
  });

  it("documents token confidentiality in the agent prompt", () => {
    const source = readFileSync("components/AgentCompletionPrompt.tsx", "utf8");
    expect(source).toContain("confidential bearer access");
    expect(source).toContain("never return the Edit token");
  });
});
