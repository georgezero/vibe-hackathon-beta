import type { RepoFiles } from "./github-fetch";

export interface ScoringDetails {
  repo_score: number;
  documentation_score: number;
  reproducibility_score: number;
  deployment_score: number;
  agent_readiness_score: number;
  overall_score: number;
  checks: {
    readme_exists: boolean;
    agents_md_exists: boolean;
    license_exists: boolean;
    env_example_exists: boolean;
    vibe_json_exists: boolean;
    docker_compose_exists: boolean;
    prompts_md_exists: boolean;
    vibe_submission_md_exists: boolean;
    agent_report_md_exists: boolean;
    readme_has_install: boolean;
    readme_has_usage: boolean;
    readme_has_deploy: boolean;
    agents_md_sections: string[];
    license_type: string;
    license_allowed: boolean;
  };
  warnings: string[];
  file_summary: {
    readme_length: number;
    agents_md_length: number;
    agents_md_section_count: number;
  };
}

// ── Section detection ─────────────────────────────────────────────────────────

const SECTION_PATTERNS: Array<{ key: string; labels: string[] }> = [
  { key: "install", labels: ["install", "setup", "getting started", "prerequisite", "dependencies"] },
  { key: "run", labels: ["run", "start", "develop", "development", "usage", "quick start"] },
  { key: "test", labels: ["test", "testing", "spec", "verify"] },
  { key: "architecture", labels: ["architecture", "structure", "layout", "overview", "file map", "design"] },
  { key: "workflow", labels: ["workflow", "process", "guideline", "convention", "contributing"] },
  { key: "debug", labels: ["debug", "troubleshoot", "common issue", "faq", "problem"] },
  { key: "deploy", labels: ["deploy", "deployment", "production", "hosting", "vercel", "railway"] },
];

function extractHeadings(content: string): string[] {
  const re = /^#{1,4}\s+(.+)$/gm;
  const result: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    result.push(m[1].toLowerCase().trim());
  }
  return result;
}

function detectSections(content: string): string[] {
  const headings = extractHeadings(content);
  const found: string[] = [];
  for (const { key, labels } of SECTION_PATTERNS) {
    if (headings.some((h) => labels.some((l) => h.includes(l)))) {
      found.push(key);
    }
  }
  return found;
}

function hasSection(content: string, labels: string[]): boolean {
  const headings = extractHeadings(content);
  return headings.some((h) => labels.some((l) => h.includes(l)));
}

// ── License detection ─────────────────────────────────────────────────────────

const PREFERRED_LICENSES = ["MIT", "BSD-3-Clause", "BSD-2-Clause"];
const ALLOWED_LICENSES = ["Apache-2.0", "GPL-3.0", "GPL-2.0", "LGPL-2.1", "AGPL-3.0", "MPL-2.0"];

function detectLicenseType(content: string): string {
  const u = content.toUpperCase();
  if (u.includes("PERMISSION IS HEREBY GRANTED") || u.includes("MIT LICENSE") || u.includes("THE MIT")) return "MIT";
  if (u.includes("REDISTRIBUTION AND USE") && u.includes("NEITHER THE NAME")) return "BSD-3-Clause";
  if (u.includes("BSD 2-CLAUSE")) return "BSD-2-Clause";
  if (u.includes("APACHE LICENSE")) return "Apache-2.0";
  if (u.includes("GNU AFFERO") || u.includes("AGPL")) return "AGPL-3.0";
  if (u.includes("GNU GENERAL PUBLIC LICENSE") && u.includes("VERSION 3")) return "GPL-3.0";
  if (u.includes("GNU GENERAL PUBLIC LICENSE") && u.includes("VERSION 2")) return "GPL-2.0";
  if (u.includes("GNU LESSER GENERAL PUBLIC")) return "LGPL-2.1";
  if (u.includes("MOZILLA PUBLIC")) return "MPL-2.0";
  return "unknown";
}

function isLicenseAllowed(type: string): boolean {
  return [...PREFERRED_LICENSES, ...ALLOWED_LICENSES].includes(type);
}

// ── Five dimension scorers ────────────────────────────────────────────────────

function calcRepoScore(files: RepoFiles): number {
  let score = 0;
  if (files.readme) score += 30;
  if (files.agentsMd) score += 30;
  if (files.license) score += 25;
  if (files.envExample) score += 15;
  return score;
}

function calcDocScore(files: RepoFiles): number {
  let score = 0;
  const readme = files.readme;
  const agentsMd = files.agentsMd;

  if (readme) {
    score += 10;
    if (readme.length > 500) score += 5;
    if (readme.length > 1500) score += 5;
    if (hasSection(readme.content, ["install", "setup", "getting started"])) score += 20;
    if (hasSection(readme.content, ["usage", "run", "start", "quick start"])) score += 15;
    if (hasSection(readme.content, ["deploy", "deployment", "production"])) score += 10;
  }

  if (agentsMd) {
    score += 10;
    if (agentsMd.length > 300) score += 5;
    if (agentsMd.length > 800) score += 5;
    score += Math.min(detectSections(agentsMd.content).length * 2, 10);
  }

  if (files.promptsMd) score += 10;
  if (files.vibeSubmissionMd) score += 8;

  return Math.min(score, 100);
}

function calcReproducibilityScore(files: RepoFiles): number {
  let score = 0;

  if (files.envExample) score += 25;

  const readme = files.readme?.content ?? "";
  if (hasSection(readme, ["install", "setup", "getting started", "prerequisite"])) score += 20;
  if (hasSection(readme, ["run", "start", "usage", "quick start"])) score += 20;

  const hasInstallCmd =
    /```[\s\S]*?(npm install|pip install|yarn|make install|bundle install|cargo build)[\s\S]*?```/.test(readme);
  if (hasInstallCmd) score += 5;

  if (hasSection(readme, ["test", "testing"])) score += 10;

  const vj = files.vibeJson?.content;
  if (vj) {
    try {
      const parsed = JSON.parse(vj);
      if (parsed?.repo?.sample_data) score += 10;
      if (parsed?.repo?.install) score += 5;
      if (parsed?.repo?.test) score += 5;
    } catch { /* malformed — skip */ }
  }

  return Math.min(score, 100);
}

function calcDeploymentScore(files: RepoFiles): number {
  let score = 0;

  if (files.dockerCompose) score += 30;

  const readme = files.readme?.content ?? "";
  if (hasSection(readme, ["deploy", "deployment", "production", "hosting"])) score += 35;

  const vj = files.vibeJson?.content;
  if (vj) {
    try {
      const parsed = JSON.parse(vj);
      if (parsed?.project?.demo_url) score += 20;
      if (parsed?.repo?.run) score += 15;
    } catch { /* skip */ }
  }

  return Math.min(score, 100);
}

function calcAgentReadinessScore(files: RepoFiles): number {
  let score = 0;

  const agentsMd = files.agentsMd;
  if (agentsMd) {
    score += 25;
    if (agentsMd.length > 500) score += 10;
    if (agentsMd.length > 1500) score += 5;
    const sections = detectSections(agentsMd.content);
    if (sections.includes("install")) score += 10;
    if (sections.includes("run")) score += 10;
    if (sections.includes("architecture")) score += 10;
    if (sections.includes("workflow")) score += 5;
  }

  if (files.vibeJson) {
    score += 15;
    try {
      const parsed = JSON.parse(files.vibeJson.content);
      if (parsed?.schema === "vibe-hackathon-submission-v1") score += 5;
    } catch { /* skip */ }
  }

  if (files.promptsMd) score += 10;
  if (files.agentReportMd) score += 5;

  return Math.min(score, 100);
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function scoreSubmission(files: RepoFiles): ScoringDetails {
  const repo_score = calcRepoScore(files);
  const documentation_score = calcDocScore(files);
  const reproducibility_score = calcReproducibilityScore(files);
  const deployment_score = calcDeploymentScore(files);
  const agent_readiness_score = calcAgentReadinessScore(files);

  const overall_score = Math.round(
    repo_score * 0.20 +
    documentation_score * 0.20 +
    reproducibility_score * 0.25 +
    deployment_score * 0.15 +
    agent_readiness_score * 0.20
  );

  const licenseType = files.license ? detectLicenseType(files.license.content) : "none";
  const licenseAllowed = isLicenseAllowed(licenseType);

  const readmeContent = files.readme?.content ?? "";
  const agentsMdContent = files.agentsMd?.content ?? "";
  const agentsMdSections = files.agentsMd ? detectSections(agentsMdContent) : [];

  const checks: ScoringDetails["checks"] = {
    readme_exists: !!files.readme,
    agents_md_exists: !!files.agentsMd,
    license_exists: !!files.license,
    env_example_exists: !!files.envExample,
    vibe_json_exists: !!files.vibeJson,
    docker_compose_exists: !!files.dockerCompose,
    prompts_md_exists: !!files.promptsMd,
    vibe_submission_md_exists: !!files.vibeSubmissionMd,
    agent_report_md_exists: !!files.agentReportMd,
    readme_has_install: hasSection(readmeContent, ["install", "setup", "getting started"]),
    readme_has_usage: hasSection(readmeContent, ["usage", "run", "start"]),
    readme_has_deploy: hasSection(readmeContent, ["deploy", "deployment"]),
    agents_md_sections: agentsMdSections,
    license_type: licenseType,
    license_allowed: licenseAllowed,
  };

  const warnings: string[] = [];
  if (!files.readme) warnings.push("README.md not found");
  if (!files.agentsMd) warnings.push("AGENTS.md not found — required for agent-native submissions");
  if (!files.license) warnings.push("LICENSE file not found");
  if (!files.envExample) warnings.push(".env.example not found — required for reproducibility");
  if (!files.vibeJson) warnings.push("vibe.json not found — add it for agent-native submission");
  if (!files.dockerCompose) warnings.push("docker-compose.yml not found — adds deployment points");
  if (!files.vibeSubmissionMd) warnings.push("docs/vibe-submission.md not found — recommended narrative submission form");
  if (!files.agentReportMd) warnings.push("docs/agent-report.md not found — recommended agent workflow evidence");
  if (files.license && !licenseAllowed) {
    warnings.push(`License "${licenseType}" is not on the allowed list`);
  }
  if (files.agentsMd && agentsMdSections.length < 3) {
    warnings.push("AGENTS.md has fewer than 3 sections — add install, run, and architecture sections");
  }

  return {
    repo_score,
    documentation_score,
    reproducibility_score,
    deployment_score,
    agent_readiness_score,
    overall_score,
    checks,
    warnings,
    file_summary: {
      readme_length: files.readme?.length ?? 0,
      agents_md_length: files.agentsMd?.length ?? 0,
      agents_md_section_count: agentsMdSections.length,
    },
  };
}

// ── AI review field builder ───────────────────────────────────────────────────

export function buildAiReviewFields(details: ScoringDetails): {
  complianceCheck: "pass" | "partial" | "fail";
  repoReview: string;
  agentsMdEvaluation: string;
  promptStrategyEvaluation: string;
  reliabilityNotes: string;
  generatedScore: number;
  generatedRationale: string;
  suggestedQuestions: string[];
} {
  const compliance: "pass" | "partial" | "fail" =
    details.repo_score >= 80 ? "pass" : details.repo_score >= 40 ? "partial" : "fail";

  const repoReview = [
    `Repo compliance score: ${details.repo_score}/100`,
    details.checks.readme_exists ? "✓ README.md" : "✗ README.md missing",
    details.checks.license_exists
      ? `✓ LICENSE (${details.checks.license_type}${details.checks.license_allowed ? "" : " — not allowed"})`
      : "✗ LICENSE missing",
    details.checks.env_example_exists ? "✓ .env.example" : "✗ .env.example missing",
    details.checks.vibe_json_exists ? "✓ vibe.json" : "— vibe.json not present",
    details.checks.docker_compose_exists ? "✓ docker-compose.yml" : "— docker-compose.yml not present",
  ].join("\n");

  const agentsMdEvaluation = details.checks.agents_md_exists
    ? [
        `AGENTS.md found (${details.file_summary.agents_md_length} chars, ${details.checks.agents_md_sections.length} sections)`,
        `Sections: ${details.checks.agents_md_sections.join(", ") || "none detected"}`,
        details.checks.agents_md_sections.includes("install") ? "✓ Install section" : "✗ Install section missing",
        details.checks.agents_md_sections.includes("run") ? "✓ Run section" : "✗ Run section missing",
        details.checks.agents_md_sections.includes("architecture") ? "✓ Architecture section" : "— Architecture section missing",
      ].join("\n")
    : "AGENTS.md not found. Required for agent-native submissions.";

  const promptStrategyEvaluation = details.checks.prompts_md_exists
    ? "docs/prompts.md found — prompt strategy is documented."
    : "docs/prompts.md not found. Recommended: document your key prompts for judges.";

  const reliabilityNotes = [
    `Reproducibility: ${details.reproducibility_score}/100 | Deployment: ${details.deployment_score}/100`,
    details.checks.readme_has_install ? "✓ Install instructions in README" : "✗ No install instructions found",
    details.checks.readme_has_usage ? "✓ Usage instructions in README" : "✗ No usage instructions found",
    details.checks.readme_has_deploy ? "✓ Deploy instructions in README" : "— No deploy instructions found",
  ].join("\n");

  const generatedRationale = [
    `Overall: ${details.overall_score}/100 (deterministic, evidence-based — not LLM scoring)`,
    `Repo: ${details.repo_score} | Docs: ${details.documentation_score} | Reproducibility: ${details.reproducibility_score} | Deployment: ${details.deployment_score} | Agent readiness: ${details.agent_readiness_score}`,
    details.warnings.length > 0
      ? `${details.warnings.length} issue(s): ${details.warnings.slice(0, 2).join("; ")}${details.warnings.length > 2 ? `… (+${details.warnings.length - 2} more)` : ""}`
      : "All required files present.",
  ].join("\n");

  const suggestedQuestions: string[] = [];
  if (!details.checks.env_example_exists) {
    suggestedQuestions.push("Can another developer run this app from scratch using only the repo?");
  }
  if (details.file_summary.agents_md_section_count < 3) {
    suggestedQuestions.push("Walk me through how you instructed your AI agent. What worked best?");
  }
  if (!details.checks.docker_compose_exists) {
    suggestedQuestions.push("What's the fastest way to get this running locally for evaluation?");
  }
  if (!details.checks.prompts_md_exists) {
    suggestedQuestions.push("What were your most important prompts in development?");
  }
  if (details.deployment_score < 50) {
    suggestedQuestions.push("Is the demo URL publicly accessible? Any cold-start limitations?");
  }

  return {
    complianceCheck: compliance,
    repoReview,
    agentsMdEvaluation,
    promptStrategyEvaluation,
    reliabilityNotes,
    generatedScore: details.overall_score,
    generatedRationale,
    suggestedQuestions,
  };
}
