import { afterEach, describe, expect, it } from "vitest";
import { getPublicationQualificationConfig, isPublicationQualificationSubmission } from "@/lib/publication-qualification";

const originalEnabled = process.env.VIBE_PUBLICATION_QUALIFICATION_ENABLED;
const originalAllowlist = process.env.VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST;

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.VIBE_PUBLICATION_QUALIFICATION_ENABLED;
  else process.env.VIBE_PUBLICATION_QUALIFICATION_ENABLED = originalEnabled;
  if (originalAllowlist === undefined) delete process.env.VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST;
  else process.env.VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST = originalAllowlist;
});

describe("D.4 submission-scoped qualification gate", () => {
  it("is disabled by default and permits nothing", () => {
    delete process.env.VIBE_PUBLICATION_QUALIFICATION_ENABLED;
    delete process.env.VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST;
    expect(getPublicationQualificationConfig()).toEqual({ enabled: false, allowlist: [], valid: true });
    expect(isPublicationQualificationSubmission("sub_d4_fixture")).toBe(false);
  });

  it("allows only the exact server configuration ID", () => {
    process.env.VIBE_PUBLICATION_QUALIFICATION_ENABLED = "true";
    process.env.VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST = "sub_d4_fixture";
    expect(isPublicationQualificationSubmission("sub_d4_fixture")).toBe(true);
    expect(isPublicationQualificationSubmission("sub_real_project")).toBe(false);
  });

  it("fails closed for empty, wildcard, and malformed allowlists", () => {
    process.env.VIBE_PUBLICATION_QUALIFICATION_ENABLED = "true";
    for (const value of ["", "*", "sub_d4_fixture,not-a-submission", "sub_d4_fixture,"]) {
      process.env.VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST = value;
      const config = getPublicationQualificationConfig();
      expect(isPublicationQualificationSubmission("sub_d4_fixture")).toBe(false);
      if (value === "") expect(config.allowlist).toEqual([]);
      else expect(config.valid).toBe(false);
    }
  });

  it("disables visibility immediately when the gate is turned off", () => {
    process.env.VIBE_PUBLICATION_QUALIFICATION_ENABLED = "true";
    process.env.VIBE_PUBLICATION_QUALIFICATION_SUBMISSION_ALLOWLIST = "sub_d4_fixture";
    expect(isPublicationQualificationSubmission("sub_d4_fixture")).toBe(true);
    process.env.VIBE_PUBLICATION_QUALIFICATION_ENABLED = "false";
    expect(isPublicationQualificationSubmission("sub_d4_fixture")).toBe(false);
  });
});
