import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("G.1 onboarding language and continuity", () => {
  it("frames draft creation as a project and keeps guest recovery available", () => {
    const source = readFileSync("app/start/StartClient.tsx", "utf8");
    const saveCard = readFileSync("components/SaveProjectCard.tsx", "utf8");
    expect(source).toContain("Start your project");
    expect(source).toContain("No account is required to begin");
    expect(saveCard).toContain("Save this project to My Projects");
    expect(source).toContain("Continue without an account");
    expect(source).toContain("Copy private project link");
    expect(source).toContain("Anyone with it can edit the project");
    expect(source).not.toContain("Outbound email is not available");
    expect(readFileSync("app/start/page.tsx", "utf8")).toContain("Resume a project");
  });

  it("uses participant language for resume and claim", () => {
    const resume = readFileSync("app/start/resume/ResumeClient.tsx", "utf8");
    const claim = readFileSync("app/claim/ClaimClient.tsx", "utf8");
    const login = readFileSync("app/login/page.tsx", "utf8");
    expect(resume).toContain("Resume a project");
    expect(resume).toContain("Open My Projects");
    expect(claim).toContain("Save this project to My Projects");
    expect(claim).toContain("Continue to account");
    expect(claim).toContain('body.authenticated ? "/claim/confirm" : "/login?returnTo=%2Fclaim%2Fconfirm"');
    expect(login).toContain('returnTo === "/claim/confirm"');
  });

  it("teaches the agent handoff and keeps the hosted contract", () => {
    const page = readFileSync("app/submit/[token]/start/page.tsx", "utf8");
    const prompt = readFileSync("components/AgentCompletionPrompt.tsx", "utf8");
    expect(page).toContain("How would you like to continue?");
    expect(page).toContain("Use a coding agent");
    expect(page).toContain("Copy agent prompt");
    expect(page).toContain("Return here to review and submit");
    expect(prompt).toContain("promptDisclosure");
    expect(prompt).toContain("confidential bearer access");
    expect(prompt).toContain("Review project preview");
  });

  it("distinguishes project Team Chat from personal Messages", () => {
    const shell = readFileSync("components/SubmissionWorkspaceShell.tsx", "utf8");
    const overview = readFileSync("app/projects/[submissionId]/page.tsx", "utf8");
    expect(shell).toContain('label: "Team Chat"');
    expect(shell).toContain('label: "Submit"');
    expect(shell).toContain("Swipe for more project sections");
    expect(overview).toContain("Open Team Chat");
    expect(overview).toContain("Private conversation with your project team.");
  });
});
