import type { ReadinessItemKey } from "@/lib/submission-readiness";

export type ProjectEditorField =
  | "teamName"
  | "contactEmail"
  | "projectTitle"
  | "problemStatement"
  | "targetUsers"
  | "setupInstructions"
  | "deployInstructions"
  | "knownLimitations"
  | "demoUrl"
  | "demoVideoUrl"
  | "githubUrl"
  | "screenshotUrls"
  | "readmeUrl"
  | "agentsMdUrl"
  | "license"
  | "sampleDataDescription"
  | "aiToolsUsed"
  | "promptStrategyUrl";

export type ProjectEditorSectionId = "basics" | "problem" | "solution" | "demo" | "data";

export type ProjectEditorSection = {
  id: ProjectEditorSectionId;
  title: string;
  description: string;
  fields: ProjectEditorField[];
};

export const PROJECT_EDITOR_SECTIONS: ProjectEditorSection[] = [
  {
    id: "basics",
    title: "Project basics",
    description: "Give your project a clear name and a reliable point of contact.",
    fields: ["projectTitle", "teamName", "contactEmail"],
  },
  {
    id: "problem",
    title: "The problem",
    description: "Help judges understand who this is for and why it matters.",
    fields: ["problemStatement", "targetUsers"],
  },
  {
    id: "solution",
    title: "Your solution",
    description: "Explain how the project works and what someone should know to use it.",
    fields: ["setupInstructions", "deployInstructions", "knownLimitations"],
  },
  {
    id: "demo",
    title: "Demo & code",
    description: "Share the links and license judges will use to review your work.",
    fields: ["demoUrl", "demoVideoUrl", "githubUrl", "screenshotUrls", "readmeUrl", "agentsMdUrl", "license"],
  },
  {
    id: "data",
    title: "Data & implementation",
    description: "Describe the data and tools behind the project.",
    fields: ["sampleDataDescription", "aiToolsUsed", "promptStrategyUrl"],
  },
];

export type ProjectEditorFieldMeta = {
  label: string;
  helper: string;
  required?: boolean;
  recommended?: boolean;
  readinessKey?: ReadinessItemKey;
  input: "text" | "email" | "url" | "textarea" | "tools";
};

export const PROJECT_EDITOR_FIELD_META: Record<ProjectEditorField, ProjectEditorFieldMeta> = {
  projectTitle: { label: "Project title", helper: "The name judges will remember.", required: true, readinessKey: "projectTitle", input: "text" },
  teamName: { label: "Team name", helper: "The team name shown with your project.", required: true, readinessKey: "teamName", input: "text" },
  contactEmail: { label: "Contact email", helper: "Used for event communication and project recovery.", required: true, readinessKey: "contactEmail", input: "email" },
  problemStatement: { label: "Problem statement", helper: "What problem are you solving, and why does it matter?", required: true, readinessKey: "problemStatement", input: "textarea" },
  targetUsers: { label: "Who is this for?", helper: "A short description of the people or teams who benefit. Recommended for a clearer story.", recommended: true, input: "textarea" },
  setupInstructions: { label: "How to run it", helper: "Explain how someone can understand or run the project from scratch.", input: "textarea" },
  deployInstructions: { label: "Deployment notes", helper: "Share the steps an evaluator should follow if deployment needs context.", input: "textarea" },
  knownLimitations: { label: "Known limitations", helper: "Set expectations about what the current version does not cover.", input: "textarea" },
  demoUrl: { label: "Working demo", helper: "Link to the working demo judges can open.", required: true, readinessKey: "demoUrl", input: "url" },
  demoVideoUrl: { label: "Demo video", helper: "Optional: a short walkthrough. YouTube, Loom, and Vimeo links are supported.", input: "url" },
  githubUrl: { label: "GitHub repository", helper: "Link to the repository judges can review.", required: true, readinessKey: "githubUrl", input: "url" },
  screenshotUrls: { label: "Project screenshot", helper: "The first image appears in your project preview. Add up to five screenshots.", required: true, readinessKey: "screenshotUrls", input: "url" },
  readmeUrl: { label: "README", helper: "Optional: link to the project README for additional context.", input: "url" },
  agentsMdUrl: { label: "AGENTS.md", helper: "Link to the instructions your coding agent used for this project.", required: true, readinessKey: "agentsMdUrl", input: "url" },
  license: { label: "Project license", helper: "Name the license for the project source, such as MIT or Apache-2.0.", required: true, readinessKey: "license", input: "text" },
  sampleDataDescription: { label: "Data used", helper: "Describe any sample, synthetic, public, or provided data your project uses. If none, say so plainly.", required: true, readinessKey: "sampleDataDescription", input: "textarea" },
  aiToolsUsed: { label: "AI tools used", helper: "Select the tools that materially helped build this project.", input: "tools" },
  promptStrategyUrl: { label: "Prompt strategy", helper: "Optional: link to prompt notes or other documentation about your agent workflow.", input: "url" },
};

export const REQUIRED_PROJECT_EDITOR_FIELDS = PROJECT_EDITOR_SECTIONS
  .flatMap((section) => section.fields)
  .filter((field) => PROJECT_EDITOR_FIELD_META[field].required);

const READINESS_FIELD_KEYS = new Set<ReadinessItemKey>([
  "teamName", "contactEmail", "projectTitle", "problemStatement", "demoUrl", "githubUrl",
  "screenshotUrls", "license", "agentsMdUrl", "sampleDataDescription",
]);

export function isRequiredEditorField(field: ProjectEditorField): boolean {
  return Boolean(PROJECT_EDITOR_FIELD_META[field].required);
}

export function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function validateProjectEditorField(field: ProjectEditorField, value: string | string[]): string | null {
  const text = Array.isArray(value) ? value.find((item) => item.trim())?.trim() ?? "" : value.trim();
  if (field === "problemStatement" && text.length > 0 && text.length < 30) return "Add a little more detail so judges can understand the problem.";
  if (field === "sampleDataDescription" && text.length > 0 && text.length < 20) return "Add a little more detail, or say that no external data was used.";
  if (["demoUrl", "demoVideoUrl", "githubUrl", "readmeUrl", "agentsMdUrl", "promptStrategyUrl"].includes(field) && text.length > 0 && !isHttpsUrl(text)) {
    return "Enter a valid HTTPS URL.";
  }
  if (field === "screenshotUrls" && text.length > 0 && !isHttpsUrl(text)) return "Enter a valid HTTPS image URL.";
  return null;
}

export function validateProjectEditorForm(form: Partial<Record<ProjectEditorField, string | string[]>>, options: { requireAll?: boolean } = {}): Record<string, string> {
  const requireAll = options.requireAll !== false;
  const errors: Record<string, string> = {};
  for (const field of PROJECT_EDITOR_SECTIONS.flatMap((section) => section.fields)) {
    const value = form[field] ?? (field === "screenshotUrls" ? [] : "");
    const text = Array.isArray(value) ? value.find((item) => item.trim())?.trim() ?? "" : value.trim();
    if (isRequiredEditorField(field) && (requireAll || text.length > 0)) {
      const min = field === "problemStatement" ? 30 : field === "sampleDataDescription" ? 20 : 1;
      if (text.length < min) errors[field] = field === "problemStatement"
        ? "Add a little more detail so judges can understand the problem."
        : field === "sampleDataDescription"
          ? "Describe the sample, synthetic, public, or provided data used by the project."
          : `${PROJECT_EDITOR_FIELD_META[field].label} is required before submitting.`;
    }
    const fieldError = validateProjectEditorField(field, value);
    if (fieldError) errors[field] = fieldError;
  }
  return errors;
}

export function getEditorSectionProgress(section: ProjectEditorSection, form: Partial<Record<ProjectEditorField, string | string[]>>) {
  const requiredFields = section.fields.filter(isRequiredEditorField);
  const complete = requiredFields.filter((field) => {
    const value = form[field];
    const text = Array.isArray(value) ? value.find((item) => item.trim())?.trim() ?? "" : String(value ?? "").trim();
    const min = field === "problemStatement" ? 30 : field === "sampleDataDescription" ? 20 : 1;
    return text.length >= min;
  }).length;
  return { complete, total: requiredFields.length };
}

export function fieldTargetForReadiness(key: ReadinessItemKey): ProjectEditorSectionId | null {
  if (!READINESS_FIELD_KEYS.has(key)) return null;
  const section = PROJECT_EDITOR_SECTIONS.find((candidate) => candidate.fields.some((field) => PROJECT_EDITOR_FIELD_META[field].readinessKey === key));
  return section?.id ?? null;
}

export function staleEditMessage(expected: string | null | undefined, actual: string): string | null {
  if (!expected) return null;
  return expected === actual ? null : "This project changed in another session. Reload before saving.";
}
