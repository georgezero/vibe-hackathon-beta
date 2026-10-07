import { NextResponse } from "next/server";
import { VIBE_JSON_REQUIREMENTS } from "@/lib/vibe-json";
import { getActiveEvent } from "@/lib/events";
import { getBaseUrl } from "@/lib/base-url";

export async function GET() {
  const activeEvent = await getActiveEvent();
  const baseUrl = getBaseUrl();

  const eventBranding = {
    name: activeEvent.displayName || process.env.VIBE_HACKATHON_EVENT_NAME || activeEvent.name,
    logo_url: activeEvent.logoUrl || process.env.VIBE_HACKATHON_EVENT_LOGO_URL || null,
    tagline: activeEvent.tagline || "Vibe coding competition for agentic devs",
    submission_deadline: activeEvent.submissionDeadline?.toISOString() ?? null,
    judging_deadline: activeEvent.judgingDeadline?.toISOString() ?? null,
    audience_voting_enabled: activeEvent.audienceVotingEnabled,
  };

  return NextResponse.json({
    event: eventBranding,
    base_url: baseUrl,
    version: "1.1",
    schema_version: VIBE_JSON_REQUIREMENTS.schema_version,

    submission_artifacts: {
      required: [
        { file: "vibe.json", description: "Machine-readable manifest — canonical submission record" },
        { file: "README.md", description: "Public project overview, install, and usage" },
        { file: "AGENTS.md", description: "Instructions for coding agents to run/deploy the repo" },
        { file: "LICENSE", description: "Open-source license (MIT or BSD-3-Clause preferred)" },
        { file: ".env.example", description: "Env var template — no real secrets" },
      ],
      recommended: [
        { file: "docs/vibe-submission.md", description: "Narrative submission form — human/agent readable", score_bonus: true },
        { file: "docs/agent-report.md", description: "Detailed agent workflow evidence for judges", score_bonus: true },
        { file: "docs/prompts.md", description: "Key prompts used during development", score_bonus: true },
      ],
      optional: [
        { file: "docker-compose.yml", description: "Adds reproducibility and deployment scoring" },
        { file: "docs/architecture.md", description: "Architecture overview" },
      ],
      never_commit: [
        "Edit tokens (edit_*)",
        "Real .env values",
        "API keys or credentials",
      ],
    },

    required_vibe_json_fields: VIBE_JSON_REQUIREMENTS.required_fields,

    submission_endpoints: [
      {
        method: "GET",
        path: "/api/v1/spec",
        description: "This document — machine-readable spec",
        auth: false,
      },
      {
        method: "GET",
        path: "/api/v1/requirements",
        description: "Valid field values (harnesses, budget tiers, etc.)",
        auth: false,
      },
      {
        method: "POST",
        path: "/api/v1/submissions",
        description: "Create a draft submission — returns { id, editToken }",
        auth: false,
        body: { teamName: "string", contactEmail: "string" },
      },
      {
        method: "POST",
        path: "/api/v1/submissions/from-repo",
        description: "One-shot: parse vibe.json → create submission → validate",
        auth: false,
        body: { vibe_json: "VibeJson object", agent_report_md: "string (optional)" },
      },
      {
        method: "PATCH",
        path: "/api/v1/submissions/:id",
        description: "Update fields. Allowed before deadline for draft and finalized submissions.",
        auth: "Bearer <editToken>",
        body: { "any submission field": "value", source: '"web" | "api" | "mcp"' },
      },
      {
        method: "POST",
        path: "/api/v1/submissions/:id/finalize",
        description: "Mark ready for judging — triggers AI repo review. Can re-finalize before deadline.",
        auth: "Bearer <editToken>",
        body: { source: '"web" | "api" | "mcp"' },
      },
      {
        method: "GET",
        path: "/api/v1/submissions/:id/status",
        description: "Public status check — does not expose editToken",
        auth: false,
      },
      {
        method: "POST",
        path: "/api/v1/validate-repo",
        description: "Score a GitHub repo before submitting",
        auth: false,
        body: { github_url: "string" },
      },
    ],

    mcp_tools: VIBE_JSON_REQUIREMENTS.mcp_tools,

    deadline_rules: {
      create: "Blocked after deadline (403 DEADLINE_PASSED)",
      update: "Blocked after deadline for both draft and finalized (403 DEADLINE_PASSED)",
      finalize: "Blocked after deadline (403 DEADLINE_PASSED)",
      re_finalize: "Allowed before deadline — re-runs AI review",
      view: "Always allowed",
      error_code: "DEADLINE_PASSED",
    },

    scoring: {
      official_formula: "human_average_score * 70% + ai_reproducibility_score * 30%",
      peoples_choice: "audience_votes only — separate track",
      ai_scoring_dimensions: ["repo", "documentation", "reproducibility", "deployment", "agent_readiness"],
      human_rubric_dimensions: [
        "Problem Selection",
        "Product Usefulness",
        "Functionality",
        "UX & Design",
        "AI Collaboration",
        "Originality",
        "Maintainability",
        "Presentation",
      ],
    },

    agent_harnesses: VIBE_JSON_REQUIREMENTS.agent_harnesses,
    budget_tiers: VIBE_JSON_REQUIREMENTS.budget_tiers,

    analytics_fields: {
      estimated_tokens: "number — total tokens consumed",
      token_estimate_method: ["exact", "exported_logs", "provider_dashboard", "rough_estimate", "unknown"],
      metadata_confidence: ["low", "medium", "high"],
      analytics_notes: "string — free-form notes",
      label: "Self-reported — not verified by platform",
    },

    source_tracking: {
      values: ["web", "api", "mcp"],
      description: "Pass as source field in PATCH/finalize body for audit log",
    },

    docs: {
      human_readable: "/submit/instructions",
      spec_file: "docs/SUBMISSION_SPEC_v1.md",
      guide_template: "docs/templates/VIBE_SUBMISSION_GUIDE.md",
      vibe_json_template: "/templates/vibe.json",
      agents_md_template: "/templates/AGENTS.md",
    },
  });
}
