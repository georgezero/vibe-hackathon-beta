import { computePrizeEligibility, type PrizeEligibilitySummary, type PrizeMember } from "@/lib/prize-eligibility";
import { resolveScreenshotUrls } from "@/lib/screenshots";

export type ReadinessStatus = "ready" | "incomplete" | "finalized";

export type ReadinessItemKey =
  | "teamEligibility"
  | "teamName"
  | "contactEmail"
  | "projectTitle"
  | "problemStatement"
  | "demoUrl"
  | "githubUrl"
  | "screenshotUrls"
  | "license"
  | "agentsMdUrl"
  | "sampleDataDescription";

export interface ReadinessItem {
  key: ReadinessItemKey;
  label: string;
  complete: boolean;
  note?: string;
}

export interface SubmissionReadinessResult {
  /** The complete checklist, including the separate prize-eligibility signal. */
  items: ReadinessItem[];
  /** Fields that must be complete before the project can be submitted. */
  requiredItems: ReadinessItem[];
  /** Reserved for event policy additions; currently no optional blockers are defined. */
  optionalItems: ReadinessItem[];
  completeCount: number;
  totalCount: number;
  completionPercent: number;
  /** All incomplete signals, including prize eligibility. */
  missingItems: ReadinessItem[];
  /** Incomplete project fields that actually block finalization. */
  missingRequiredItems: ReadinessItem[];
  completenessState: "complete" | "incomplete";
  canSubmit: boolean;
  status: ReadinessStatus;
  teamEligibility: PrizeEligibilitySummary;
}

type SubmissionLike = {
  status: string;
  teamName: string | null;
  contactEmail: string | null;
  projectTitle: string | null;
  problemStatement: string | null;
  demoUrl: string | null;
  githubUrl: string | null;
  screenshotUrl: string | null;
  screenshotUrls: string[] | null;
  license: string | null;
  agentsMdUrl: string | null;
  sampleDataDescription: string | null;
};

function textPresent(value: string | null | undefined, minLength = 1) {
  return Boolean(value && value.trim().length >= minLength);
}

export function computeSubmissionReadiness(submission: SubmissionLike, members: PrizeMember[]): SubmissionReadinessResult {
  const teamEligibility = computePrizeEligibility(members);
  const screenshots = resolveScreenshotUrls(submission);
  const items: ReadinessItem[] = [
    { key: "teamName", label: "Team Name", complete: textPresent(submission.teamName) },
    { key: "contactEmail", label: "Contact Email", complete: textPresent(submission.contactEmail) },
    { key: "projectTitle", label: "Project Title", complete: textPresent(submission.projectTitle) },
    { key: "problemStatement", label: "Problem Statement", complete: textPresent(submission.problemStatement, 30), note: "Aim for a clear problem and why it matters." },
    { key: "demoUrl", label: "Demo URL", complete: textPresent(submission.demoUrl) },
    { key: "githubUrl", label: "GitHub URL", complete: textPresent(submission.githubUrl) },
    { key: "screenshotUrls", label: "Screenshot URL", complete: screenshots.length > 0 },
    { key: "license", label: "License", complete: textPresent(submission.license) },
    { key: "agentsMdUrl", label: "AGENTS.md URL", complete: textPresent(submission.agentsMdUrl) },
    { key: "sampleDataDescription", label: "Sample Data Notes", complete: textPresent(submission.sampleDataDescription, 20) },
    { key: "teamEligibility", label: "Team Eligibility", complete: teamEligibility.eligibleForPrize, note: teamEligibility.eligibleForPrize ? undefined : "All team members need badge numbers for prize eligibility." },
  ];
  // Badge completion is an event-prize concern, not a project-content
  // requirement. Keep it visible in `items`/`missingItems`, but do not let it
  // make an otherwise complete project impossible to submit.
  const requiredItems = items.filter((item) => item.key !== "teamEligibility");
  const optionalItems: ReadinessItem[] = [];
  const completeCount = requiredItems.filter((item) => item.complete).length;
  const totalCount = requiredItems.length;
  const completionPercent = Math.round((completeCount / totalCount) * 100);
  const missingItems = items.filter((item) => !item.complete);
  const missingRequiredItems = requiredItems.filter((item) => !item.complete);
  const finalized = submission.status === "submitted" || submission.status === "finalized" || submission.status === "locked";
  const completenessState = missingRequiredItems.length === 0 ? "complete" : "incomplete";
  const status: ReadinessStatus = finalized ? "finalized" : completenessState === "complete" ? "ready" : "incomplete";

  return {
    items,
    requiredItems,
    optionalItems,
    completeCount,
    totalCount,
    completionPercent,
    missingItems,
    missingRequiredItems,
    completenessState,
    canSubmit: !finalized && completenessState === "complete",
    status,
    teamEligibility,
  };
}
