import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { boundedUnreadCount, participantNavigationState } from "@/lib/participant-navigation";

describe("H.1 participant navigation state", () => {
  const now = new Date("2026-08-10T12:00:00.000Z");

  it("keeps My Projects as the participant home while exposing event state separately", () => {
    expect(participantNavigationState({ submissionDeadline: new Date("2026-08-11T12:00:00.000Z"), publicationStatus: "calculated", now })).toEqual({ submissionsOpen: true, resultsPublished: false });
    expect(participantNavigationState({ submissionDeadline: new Date("2026-08-09T12:00:00.000Z"), publicationStatus: "published", now })).toEqual({ submissionsOpen: false, resultsPublished: true });
  });

  it("hides creation while frozen even when the deadline is open", () => {
    expect(participantNavigationState({ isFrozen: true, submissionDeadline: new Date("2026-08-11T12:00:00.000Z"), now }).submissionsOpen).toBe(false);
  });

  it("uses exact server-time boundaries and treats archived releases as published", () => {
    expect(participantNavigationState({ submissionDeadline: now, publicationStatus: "archived", now })).toEqual({ submissionsOpen: false, resultsPublished: true });
    expect(participantNavigationState({ submissionDeadline: null, publicationStatus: "approved", now })).toEqual({ submissionsOpen: true, resultsPublished: false });
  });

  it("bounds unread indicators without changing their discoverability", () => {
    expect(boundedUnreadCount(-4)).toBe(0);
    expect(boundedUnreadCount(3.9)).toBe(3);
    expect(boundedUnreadCount(Number.NaN)).toBe(0);
  });
});

describe("H.1 navigation structure", () => {
  const source = readFileSync("components/Nav.tsx", "utf8");

  it("keeps canonical participant labels and separates local workspace context", () => {
    expect(source).toContain('href="/account/projects"');
    expect(source).toContain("My Projects");
    expect(source).toContain('href="/projects"');
    expect(source).toContain('label: "People"');
    expect(source).toContain('label: "AI Evals"');
    expect(source).toContain('className={`site-nav${workspaceContext ? " is-workspace-context" : ""}`}');
  });

  it("does not put Team Chat in global navigation or expose unpublished Results", () => {
    expect(source).not.toContain('href="/team-chat"');
    expect(source).toContain("...(resultsPublished ? [{ href: \"/winners\", label: \"Results\" }] : [])");
  });

  it("preserves independent admin and judge navigation branches", () => {
    expect(source).toContain('href="/judge/dashboard"');
    expect(source).toContain('href="/admin/dashboard"');
    expect(source).toContain('variant === "judge"');
    expect(source).toContain('variant === "admin"');
  });
});
