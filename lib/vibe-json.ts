export interface VibeJson {
  schema: "vibe-hackathon-submission-v1";
  team: {
    name: string;
    contact_email: string;
    members?: Array<{ name: string; role?: string }>;
    github_org?: string;
  };
  project: {
    name: string;
    summary: string;
    demo_url: string;
    demo_video_url?: string;
    github_url: string;
    screenshot_url?: string;
    screenshot_urls?: string[];
    target_users?: string[];
    tags?: string[];
  };
  repo: {
    license: string;
    agents_md_url: string;
    readme_url?: string;
    env_example?: string;
    install: string;
    run: string;
    test?: string;
    sample_data?: string;
  };
  agentic_dev: {
    harnesses: string[];
    models: string[];
    local_models?: string[];
    budget_tier: string;

    // Self-reported time estimates
    estimated_human_hours?: number;
    estimated_agent_hours?: number;

    // Self-reported token/cost analytics
    estimated_tokens?: number;
    token_estimate_method?: "exact" | "exported_logs" | "provider_dashboard" | "rough_estimate" | "unknown";
    metadata_confidence?: "low" | "medium" | "high";
    analytics_notes?: string;

    prompt_notes_url?: string;
    agent_report_url?: string;
    known_limitations?: string;
  };
}

export const BUDGET_TIERS = [
  "free_trial_only",
  "standard_subscription",
  "multiple_paid_subscriptions",
  "api_under_10",
  "api_10_to_50",
  "api_50_to_200",
  "api_over_200",
  "local_models_only",
  "unknown",
] as const;

export type BudgetTier = (typeof BUDGET_TIERS)[number];

export const VIBE_JSON_REQUIREMENTS = {
  schema_version: "vibe-hackathon-submission-v1",
  required_files: ["README.md", "AGENTS.md", "LICENSE", ".env.example"],
  required_fields: [
    "team.name",
    "team.contact_email",
    "project.name",
    "project.summary",
    "project.demo_url",
    "project.github_url",
    "repo.license",
    "repo.agents_md_url",
    "repo.install",
    "repo.run",
    "agentic_dev.harnesses",
    "agentic_dev.models",
    "agentic_dev.budget_tier",
  ],
  recommended_files: [
    "docs/prompts.md",
    "docs/architecture.md",
    "docs/limitations.md",
    "docs/agent-log.md",
    "docs/agent-report.md",
    "vibe.json",
  ],
  optional_files: [
    "docker-compose.yml",
    "Makefile",
    "skills/",
    "evals/",
    "mcp/",
  ],
  license_guidance:
    "MIT or BSD-3-Clause preferred. Apache-2.0 allowed. Proprietary licenses not accepted.",
  preferred_licenses: ["MIT", "BSD-3-Clause", "BSD-2-Clause"],
  allowed_licenses: ["Apache-2.0", "GPL-3.0", "LGPL-2.1", "AGPL-3.0", "MPL-2.0"],
  agent_harnesses: [
    "Claude Code",
    "Codex CLI",
    "Cursor",
    "Aider",
    "Devin",
    "SWE-agent",
    "GitHub Copilot",
    "Windsurf",
    "Other",
  ],
  budget_tiers: BUDGET_TIERS,
  mcp_tools: [
    "vibe.list_requirements",
    "vibe.validate_repo",
    "vibe.create_submission",
    "vibe.update_submission",
    "vibe.finalize_submission",
    "vibe.get_submission_status",
    "vibe.submit_agent_report",
  ],
};

export function parseVibeJson(raw: unknown): { ok: true; data: VibeJson } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "vibe.json must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  if (obj.schema !== "vibe-hackathon-submission-v1") {
    return { ok: false, error: `schema must be "vibe-hackathon-submission-v1", got: ${obj.schema}` };
  }

  const team = obj.team as Record<string, unknown> | undefined;
  if (!team?.name || typeof team.name !== "string") {
    return { ok: false, error: "team.name is required" };
  }
  if (!team?.contact_email || typeof team.contact_email !== "string") {
    return { ok: false, error: "team.contact_email is required" };
  }

  const project = obj.project as Record<string, unknown> | undefined;
  if (!project?.name || typeof project.name !== "string") {
    return { ok: false, error: "project.name is required" };
  }
  if (!project?.summary || typeof project.summary !== "string") {
    return { ok: false, error: "project.summary is required" };
  }
  if (!project?.demo_url || typeof project.demo_url !== "string") {
    return { ok: false, error: "project.demo_url is required" };
  }
  if (!project?.github_url || typeof project.github_url !== "string") {
    return { ok: false, error: "project.github_url is required" };
  }

  const repo = obj.repo as Record<string, unknown> | undefined;
  if (!repo?.license || typeof repo.license !== "string") {
    return { ok: false, error: "repo.license is required" };
  }
  if (!repo?.agents_md_url || typeof repo.agents_md_url !== "string") {
    return { ok: false, error: "repo.agents_md_url is required" };
  }
  if (!repo?.install || typeof repo.install !== "string") {
    return { ok: false, error: "repo.install is required" };
  }
  if (!repo?.run || typeof repo.run !== "string") {
    return { ok: false, error: "repo.run is required" };
  }

  const agentic_dev = obj.agentic_dev as Record<string, unknown> | undefined;
  if (!Array.isArray(agentic_dev?.harnesses) || agentic_dev.harnesses.length === 0) {
    return { ok: false, error: "agentic_dev.harnesses must be a non-empty array" };
  }
  if (!Array.isArray(agentic_dev?.models) || agentic_dev.models.length === 0) {
    return { ok: false, error: "agentic_dev.models must be a non-empty array" };
  }
  if (!agentic_dev?.budget_tier || typeof agentic_dev.budget_tier !== "string") {
    return { ok: false, error: "agentic_dev.budget_tier is required" };
  }

  return { ok: true, data: raw as VibeJson };
}
