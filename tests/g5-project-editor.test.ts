import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PROJECT_EDITOR_FIELD_META,
  PROJECT_EDITOR_SECTIONS,
  REQUIRED_PROJECT_EDITOR_FIELDS,
  fieldTargetForReadiness,
  getEditorSectionProgress,
  isHttpsUrl,
  staleEditMessage,
  validateProjectEditorField,
  validateProjectEditorForm,
} from "@/lib/project-editor";
import { computeSubmissionEditVersion } from "@/lib/submission-edit-version";

describe("G.5 project-story editor metadata", () => {
  it("keeps the ten G.3 required fields authoritative and team management separate", () => {
    expect(REQUIRED_PROJECT_EDITOR_FIELDS).toEqual([
      "projectTitle", "teamName", "contactEmail", "problemStatement", "demoUrl", "githubUrl",
      "screenshotUrls", "agentsMdUrl", "license", "sampleDataDescription",
    ]);
    expect(PROJECT_EDITOR_SECTIONS.flatMap((section) => section.fields)).not.toContain("members");
    expect(PROJECT_EDITOR_FIELD_META.targetUsers.recommended).toBe(true);
  });

  it("uses actionable validation without exposing raw validator language", () => {
    expect(validateProjectEditorField("problemStatement", "too short")).toContain("judges can understand");
    expect(validateProjectEditorField("sampleDataDescription", "none")).toContain("external data");
    expect(validateProjectEditorField("githubUrl", "http://github.com/team/project")).toBe("Enter a valid HTTPS URL.");
    expect(isHttpsUrl("https://github.com/team/project")).toBe(true);
    expect(isHttpsUrl("http://github.com/team/project")).toBe(false);
  });

  it("counts required completion per section and targets missing readiness fields", () => {
    const form = { projectTitle: "Project", teamName: "Team", contactEmail: "team@example.invalid" };
    expect(getEditorSectionProgress(PROJECT_EDITOR_SECTIONS[0], form)).toEqual({ complete: 3, total: 3 });
    expect(getEditorSectionProgress(PROJECT_EDITOR_SECTIONS[3], form)).toEqual({ complete: 0, total: 5 });
    expect(fieldTargetForReadiness("demoUrl")).toBe("demo");
    expect(fieldTargetForReadiness("teamEligibility")).toBeNull();
  });

  it("validates all required fields while preserving optional fields as non-blocking", () => {
    const errors = validateProjectEditorForm({ projectTitle: "Project", targetUsers: "" });
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(["teamName", "contactEmail", "problemStatement", "demoUrl", "githubUrl", "screenshotUrls", "agentsMdUrl", "license", "sampleDataDescription"]));
    expect(errors.targetUsers).toBeUndefined();
  });
});

describe("G.5 stale browser/agent edit protection", () => {
  const base = { id: "sub_g5", status: "draft", projectTitle: "Version A", githubUrl: "https://github.com/team/project" };
  const member = { id: "member_g5", name: "Rowan Mercer", order: 0 };

  it("changes the migration-free edit fingerprint when hosted content changes", () => {
    const a = computeSubmissionEditVersion(base, [member]);
    const b = computeSubmissionEditVersion({ ...base, projectTitle: "Version B" }, [member]);
    expect(a).not.toBe(b);
    expect(staleEditMessage(a, b)).toContain("changed in another session");
    expect(staleEditMessage(b, b)).toBeNull();
  });

  it("does not include bearer credentials in the edit fingerprint", () => {
    const a = computeSubmissionEditVersion({ ...base, editToken: "secret-a" }, [member]);
    const b = computeSubmissionEditVersion({ ...base, editToken: "secret-b" }, [member]);
    expect(a).toBe(b);
  });

  it("wires the fingerprint through both private load and hosted update routes", () => {
    const loadRoute = readFileSync("app/api/submissions/token/[token]/route.ts", "utf8");
    const updateRoute = readFileSync("app/api/v1/submissions/[id]/route.ts", "utf8");
    expect(loadRoute).toContain("editVersion");
    expect(updateRoute).toContain("expectedEditVersion");
    expect(updateRoute).toContain("STALE_PROJECT_EDIT");
  });
});
