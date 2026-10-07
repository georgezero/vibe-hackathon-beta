import { VIBE_JSON_REQUIREMENTS } from "./vibe-json";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

const PREFERRED_LICENSES = VIBE_JSON_REQUIREMENTS.preferred_licenses.map((l) =>
  l.toUpperCase()
);
const ALLOWED_LICENSES = VIBE_JSON_REQUIREMENTS.allowed_licenses.map((l) =>
  l.toUpperCase()
);

function normalizeId(s: string) {
  return s.toUpperCase().replace(/[-. ]/g, "");
}

function checkLicense(license: string): "preferred" | "allowed" | "disallowed" {
  const n = normalizeId(license);
  if (PREFERRED_LICENSES.some((l) => normalizeId(l) === n)) return "preferred";
  if (ALLOWED_LICENSES.some((l) => normalizeId(l) === n)) return "allowed";
  return "disallowed";
}

export function validateRepo(data: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // ── Required fields (errors, -10 to -20 each) ──────────────────────────────

  if (!data.github_url && !data.githubUrl) {
    errors.push("GitHub repo URL is required");
    score -= 20;
  }

  if (!data.demo_url && !data.demoUrl) {
    errors.push("Live demo URL is required");
    score -= 20;
  }

  if (!data.agents_md_url && !data.agentsMdUrl) {
    errors.push("AGENTS.md URL is required (repo.agents_md_url)");
    score -= 15;
  }

  const license = ((data.license ?? data.repo_license ?? "") as string).trim();
  if (!license) {
    errors.push("License is required (MIT or BSD-3-Clause preferred)");
    score -= 10;
  } else {
    const licenseStatus = checkLicense(license);
    if (licenseStatus === "disallowed") {
      errors.push(
        `License "${license}" is not permitted. Use MIT, BSD-3-Clause, or Apache-2.0.`
      );
      score -= 10;
    } else if (licenseStatus === "allowed") {
      warnings.push(
        `License "${license}" is accepted but MIT or BSD-3-Clause are preferred`
      );
      score -= 2;
    }
  }

  if (!data.sample_data_description && !data.sampleDataDescription && !data.sample_data) {
    errors.push("Sample/fake data description is required (repo.sample_data)");
    score -= 10;
  }

  const install = (data.install ?? data.setup_instructions ?? data.setupInstructions ?? "") as string;
  if (!install) {
    errors.push("Install/setup instructions are required (repo.install)");
    score -= 5;
  }

  const run = (data.run ?? data.run_command ?? "") as string;
  if (!run) {
    errors.push("Run command is required (repo.run)");
    score -= 5;
  }

  // ── Agentic dev fields (errors, -5 each) ───────────────────────────────────

  const harnesses = data.harnesses ?? data.agentHarnesses ?? data.agent_harnesses;
  if (!harnesses || !Array.isArray(harnesses) || harnesses.length === 0) {
    errors.push("At least one agent harness is required (agentic_dev.harnesses)");
    score -= 5;
  }

  const models = data.models ?? data.agentModels ?? data.agent_models;
  if (!models || !Array.isArray(models) || models.length === 0) {
    errors.push("At least one AI model is required (agentic_dev.models)");
    score -= 5;
  }

  const budgetTier = (data.budget_tier ?? data.budgetTier ?? "") as string;
  if (!budgetTier) {
    errors.push("Budget tier is required (agentic_dev.budget_tier)");
    score -= 3;
  } else if (
    !VIBE_JSON_REQUIREMENTS.budget_tiers.includes(budgetTier as never)
  ) {
    warnings.push(
      `Unknown budget tier "${budgetTier}". Use one of: ${VIBE_JSON_REQUIREMENTS.budget_tiers.join(", ")}`
    );
    score -= 1;
  }

  // ── Recommended fields (warnings, -2 to -5 each) ───────────────────────────

  if (!data.readme_url && !data.readmeUrl) {
    warnings.push("README.md URL is recommended (repo.readme_url)");
    score -= 3;
  }

  if (!data.screenshot_url && !data.screenshotUrl) {
    warnings.push("Screenshot URL is recommended (project.screenshot_url)");
    score -= 3;
  }

  if (!data.prompt_notes_url && !data.promptNotesUrl && !data.promptStrategyUrl) {
    warnings.push(
      "Prompt strategy URL is recommended (agentic_dev.prompt_notes_url)"
    );
    score -= 2;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score: Math.max(0, score),
  };
}
