import { createHash } from "node:crypto";

type EditableSubmission = Record<string, unknown>;
type EditableMember = Record<string, unknown>;

const EDITABLE_FIELDS = [
  "teamName", "contactEmail", "projectTitle", "problemStatement", "targetUsers", "demoUrl", "demoVideoUrl",
  "githubUrl", "screenshotUrl", "screenshotUrls", "readmeUrl", "agentsMdUrl", "promptStrategyUrl",
  "sampleDataDescription", "setupInstructions", "deployInstructions", "knownLimitations", "aiToolsUsed", "tags",
  "license", "agentHarnesses", "agentModels", "budgetTier", "estimatedHumanHours", "estimatedAgentHours",
  "vibeJsonRaw", "agentReportUrl", "agentReportRaw", "status",
] as const;

const MEMBER_FIELDS = ["id", "name", "email", "role", "badgeNumber", "affiliation", "degrees", "isStudentTrainee", "order"] as const;

function canonicalValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalValue(item)]));
  }
  return value ?? null;
}

export function computeSubmissionEditVersion(submission: EditableSubmission, members: EditableMember[] = []): string {
  const payload = {
    submission: Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, canonicalValue(submission[field])])),
    members: members.map((member) => Object.fromEntries(MEMBER_FIELDS.map((field) => [field, canonicalValue(member[field])]))),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
