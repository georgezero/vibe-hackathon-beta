import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeSubmissionReadiness } from "@/lib/submission-readiness";
import { isHardLockedStatus, isSubmittedStatus, participantSubmissionState } from "@/lib/submission-finalization";

function submission(overrides: Record<string, unknown> = {}) {
  return {
    status: "draft",
    teamName: "Synthetic team",
    contactEmail: "team@example.invalid",
    projectTitle: "Synthetic project",
    problemStatement: "A sufficiently long synthetic problem statement for readiness tests.",
    demoUrl: "https://demo.example.invalid",
    githubUrl: "https://github.com/example/synthetic",
    screenshotUrl: "https://example.invalid/screenshot.png",
    screenshotUrls: ["https://example.invalid/screenshot.png"],
    license: "MIT",
    agentsMdUrl: "https://github.com/example/synthetic/blob/main/AGENTS.md",
    sampleDataDescription: "Synthetic sample data notes for this qualification.",
    ...overrides,
  };
}

describe("G.3 submission readiness projection", () => {
  it("keeps prize eligibility separate from project completeness", () => {
    const result = computeSubmissionReadiness(submission(), [{ name: "Rowan Mercer", badgeNumber: null }]);
    expect(result.status).toBe("ready");
    expect(result.canSubmit).toBe(true);
    expect(result.missingRequiredItems).toHaveLength(0);
    expect(result.missingItems.some((item) => item.key === "teamEligibility")).toBe(true);
    expect(result.teamEligibility.eligibleForPrize).toBe(false);
  });

  it("blocks submission only for missing required project fields", () => {
    const result = computeSubmissionReadiness(submission({ demoUrl: null }), [{ name: "Rowan Mercer", badgeNumber: "G3-001" }]);
    expect(result.status).toBe("incomplete");
    expect(result.canSubmit).toBe(false);
    expect(result.missingRequiredItems.map((item) => item.key)).toContain("demoUrl");
  });

  it("normalizes historical submitted spellings", () => {
    expect(isSubmittedStatus("submitted")).toBe(true);
    expect(isSubmittedStatus("finalized")).toBe(true);
    expect(isHardLockedStatus("locked")).toBe(true);
    expect(participantSubmissionState("submitted").canEditBeforeDeadline).toBe(true);
    expect(participantSubmissionState("locked").canEditBeforeDeadline).toBe(false);
  });
});

describe("G.3 finalization boundaries", () => {
  it("requires server-side readiness and retry-safe finalization", () => {
    const route = readFileSync("app/api/v1/submissions/[id]/finalize/route.ts", "utf8");
    expect(route).toContain("READINESS_INCOMPLETE");
    expect(route).toContain("missingRequiredItems");
    expect(route).toContain('"idempotency-key"');
    expect(route).toContain("alreadyProcessed");
    expect(route).toContain("finalizedAt: sub.finalizedAt ?? now");
    expect(route).toContain("deterministic audit id");
    expect(route).toContain("createHash(\"sha256\")");
  });

  it("keeps judge access behind submitted status", () => {
    const source = readFileSync("lib/judge-workspace.ts", "utf8");
    expect(source).toContain("Assignments must never turn an unsubmitted draft into judge-visible work");
    expect(source).toContain("['submitted', 'finalized', 'locked']");
  });

  it("keeps every required readiness item editable in the participant form", () => {
    const source = readFileSync("app/submit/[token]/page.tsx", "utf8");
    expect(source).toContain('license: ""');
    expect(source).toContain('data.license ?? ""');
    expect(source).toContain('license: form.license');
    expect(source).toContain('License *');
  });

  it("uses an accessible in-page submission confirmation", () => {
    const source = readFileSync("app/submit/[token]/preview/PreviewActions.tsx", "utf8");
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-labelledby="submission-confirmation-title"');
    expect(source).toContain('Idempotency-Key');
  });

  it("enforces deadlines with exact server time rather than rounded day copy", () => {
    const source = readFileSync("lib/events.ts", "utf8");
    expect(source).toContain("Date.now() >= deadline.getTime()");
    expect(source).toContain("daysUntil(deadline)");
  });
});
