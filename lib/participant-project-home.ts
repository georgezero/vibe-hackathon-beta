import type { ReadinessItem, SubmissionReadinessResult } from "@/lib/submission-readiness";

export type ParticipantProjectLifecycle =
  | "Draft"
  | "Needs attention"
  | "Ready to submit"
  | "Submitted"
  | "Judging"
  | "Results pending"
  | "Results available";

export type ParticipantAttention = {
  kind: "readiness" | "team";
  label: string;
  detail: string;
};

export type ParticipantNextAction = {
  label: "Continue project" | "Complete team" | "Review & submit" | "View project" | "View results";
  destination: "workspace" | "team" | "results";
};

export type ParticipantProjectHomeInput = {
  submissionStatus: string;
  readinessStatus: "ready" | "incomplete" | "finalized" | null;
  eventStage: "submissions_open" | "submissions_closed" | "judging" | "judging_closed" | "winners_published" | null;
  publicationStatus: "calculated" | "reviewed" | "approved" | "published" | "archived" | null;
  attention: ParticipantAttention | null;
};

const LIFECYCLE_PRIORITY: Record<ParticipantProjectLifecycle, number> = {
  "Needs attention": 0,
  "Ready to submit": 1,
  Draft: 2,
  Submitted: 3,
  Judging: 4,
  "Results pending": 5,
  "Results available": 6,
};

const READINESS_LABELS: Record<ReadinessItem["key"], string> = {
  teamEligibility: "Team eligibility",
  teamName: "Team name",
  contactEmail: "Contact email",
  projectTitle: "Project title",
  problemStatement: "Problem statement",
  demoUrl: "Demo link",
  githubUrl: "GitHub link",
  screenshotUrls: "Project screenshot",
  license: "License",
  agentsMdUrl: "AGENTS.md link",
  sampleDataDescription: "Sample data notes",
};

/**
 * The participant-facing lifecycle projection.  Event/judging/publication
 * state is resolved on the server; this function only translates that
 * authoritative state into the small vocabulary used by My Projects.
 */
export function participantProjectLifecycle(input: ParticipantProjectHomeInput): ParticipantProjectLifecycle {
  const draftLike = input.submissionStatus === "draft" || input.submissionStatus === "ready";
  if (!draftLike && (input.publicationStatus === "published" || input.publicationStatus === "archived" || input.eventStage === "winners_published")) {
    return "Results available";
  }
  // Older qualified event fixtures use `ready` for a draft that has passed
  // readiness checks. Keep that storage spelling behind the same participant
  // vocabulary without changing the submission domain.
  if (draftLike) {
    if (input.attention) return "Needs attention";
    if (input.readinessStatus === "ready") return "Ready to submit";
    return "Draft";
  }
  if (input.eventStage === "judging") return "Judging";
  if (input.eventStage === "judging_closed") return "Results pending";
  return "Submitted";
}

export function participantNextAction(
  lifecycle: ParticipantProjectLifecycle,
  attention: ParticipantAttention | null,
): ParticipantNextAction {
  if (lifecycle === "Needs attention") {
    return attention?.kind === "team"
      ? { label: "Complete team", destination: "team" }
      : { label: "Continue project", destination: "workspace" };
  }
  if (lifecycle === "Ready to submit") return { label: "Review & submit", destination: "workspace" };
  if (lifecycle === "Results available") return { label: "View results", destination: "results" };
  return { label: lifecycle === "Draft" ? "Continue project" : "View project", destination: "workspace" };
}

/** Convert readiness's internal labels into one concise participant action. */
export function participantAttention(readiness: SubmissionReadinessResult): ParticipantAttention | null {
  const team = readiness.teamEligibility;
  const missing = readiness.missingItems.find((item) => item.key !== "teamEligibility");
  if (missing) {
    const label = READINESS_LABELS[missing.key] ?? missing.label;
    return { kind: "readiness", label: "Project needs attention", detail: `${label} is still missing.` };
  }
  if (team.eligibleForPrize) return null;
  const missingBadges = team.missingBadgeCount;
  const badgeCopy = `${team.badgeCount} of ${team.memberCount} badge numbers added.`;
  return {
    kind: "team",
    label: "Team needs attention",
    detail: missingBadges > 0
      ? `${badgeCopy} Add ${missingBadges === 1 ? "the remaining badge number" : `${missingBadges} remaining badge numbers`} for prize eligibility.`
      : "Add your team details before submitting.",
  };
}

export function participantLifecyclePriority(lifecycle: ParticipantProjectLifecycle) {
  return LIFECYCLE_PRIORITY[lifecycle];
}

export type SortableParticipantProject = {
  lifecycle: ParticipantProjectLifecycle;
  updatedAt: Date | null;
  title: string;
  id: string;
};

export function sortParticipantProjects<T extends SortableParticipantProject>(projects: T[]): T[] {
  return [...projects].sort((left, right) => {
    const priority = participantLifecyclePriority(left.lifecycle) - participantLifecyclePriority(right.lifecycle);
    if (priority !== 0) return priority;
    const dates = (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0);
    if (dates !== 0) return dates;
    const titles = left.title.localeCompare(right.title);
    return titles !== 0 ? titles : left.id.localeCompare(right.id);
  });
}

export function participantHomeSummary(lifecycles: ParticipantProjectLifecycle[]) {
  const attention = lifecycles.filter((lifecycle) => lifecycle === "Needs attention").length;
  return { total: lifecycles.length, attention };
}
