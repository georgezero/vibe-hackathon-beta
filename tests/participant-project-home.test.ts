import { describe, expect, it } from "vitest";
import {
  participantAttention,
  participantHomeSummary,
  participantNextAction,
  participantProjectLifecycle,
  sortParticipantProjects,
} from "@/lib/participant-project-home";

function readiness(overrides: Partial<Parameters<typeof participantAttention>[0]> = {}) {
  return {
    items: [],
    requiredItems: [],
    optionalItems: [],
    completeCount: 10,
    totalCount: 10,
    completionPercent: 100,
    missingItems: [],
    missingRequiredItems: [],
    completenessState: "complete" as const,
    canSubmit: true,
    status: "ready" as const,
    teamEligibility: {
      memberCount: 2,
      badgeCount: 2,
      missingBadgeCount: 0,
      studentTraineeCount: 0,
      eligibleForPrize: true,
      missingMembers: [],
    },
    ...overrides,
  };
}

describe("participant project home projection", () => {
  it("maps draft, attention, ready, judging, pending, and published states", () => {
    expect(participantProjectLifecycle({ submissionStatus: "draft", readinessStatus: null, eventStage: "submissions_open", publicationStatus: null, attention: null })).toBe("Draft");
    expect(participantProjectLifecycle({ submissionStatus: "draft", readinessStatus: "incomplete", eventStage: "submissions_open", publicationStatus: null, attention: { kind: "readiness", label: "Project needs attention", detail: "Demo link is still missing." } })).toBe("Needs attention");
    expect(participantProjectLifecycle({ submissionStatus: "draft", readinessStatus: "ready", eventStage: "submissions_open", publicationStatus: null, attention: null })).toBe("Ready to submit");
    expect(participantProjectLifecycle({ submissionStatus: "ready", readinessStatus: "ready", eventStage: "submissions_open", publicationStatus: null, attention: null })).toBe("Ready to submit");
    expect(participantProjectLifecycle({ submissionStatus: "submitted", readinessStatus: "finalized", eventStage: "judging", publicationStatus: null, attention: null })).toBe("Judging");
    expect(participantProjectLifecycle({ submissionStatus: "submitted", readinessStatus: "finalized", eventStage: "submissions_open", publicationStatus: "calculated", attention: null })).toBe("Submitted");
    expect(participantProjectLifecycle({ submissionStatus: "submitted", readinessStatus: "finalized", eventStage: "judging_closed", publicationStatus: null, attention: null })).toBe("Results pending");
    expect(participantProjectLifecycle({ submissionStatus: "submitted", readinessStatus: "finalized", eventStage: "winners_published", publicationStatus: "published", attention: null })).toBe("Results available");
  });

  it("turns readiness into root-cause participant copy", () => {
    expect(participantAttention(readiness({
      status: "incomplete",
      missingItems: [{ key: "demoUrl", label: "Demo URL", complete: false }],
    }))).toEqual({ kind: "readiness", label: "Project needs attention", detail: "Demo link is still missing." });
    const teamAttention = participantAttention(readiness({
      status: "incomplete",
      missingItems: [{ key: "teamEligibility", label: "Team Eligibility", complete: false }],
      teamEligibility: { memberCount: 3, badgeCount: 2, missingBadgeCount: 1, studentTraineeCount: 1, eligibleForPrize: false, missingMembers: ["Priya"] },
    }));
    expect(teamAttention?.detail).toContain("Add the remaining badge number");
  });

  it("maps one clear next action without hiding the workspace", () => {
    expect(participantNextAction("Needs attention", { kind: "team", label: "Team needs attention", detail: "Add a badge number." })).toEqual({ label: "Complete team", destination: "team" });
    expect(participantNextAction("Ready to submit", null).label).toBe("Review & submit");
    expect(participantNextAction("Results available", null)).toEqual({ label: "View results", destination: "results" });
  });

  it("sorts attention before ready work and uses recency as a tiebreaker", () => {
    const sorted = sortParticipantProjects([
      { id: "old-ready", title: "Ready", lifecycle: "Ready to submit" as const, updatedAt: new Date("2026-08-01") },
      { id: "new-draft", title: "Draft", lifecycle: "Draft" as const, updatedAt: new Date("2026-08-09") },
      { id: "attention", title: "Attention", lifecycle: "Needs attention" as const, updatedAt: new Date("2026-08-02") },
    ]);
    expect(sorted.map((project) => project.id)).toEqual(["attention", "old-ready", "new-draft"]);
  });

  it("summarizes only participant-actionable attention", () => {
    expect(participantHomeSummary(["Needs attention", "Ready to submit", "Submitted"])).toEqual({ total: 3, attention: 1 });
  });
});
