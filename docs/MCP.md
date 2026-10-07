# Vibe Hackathon MCP Tool Interface

This document describes the MCP (Model Context Protocol) tool interface for the Vibe Hackathon platform. These tools allow AI agents to submit, update, and query hackathon submissions programmatically.

---

## Tool: `vibe.list_requirements`

Returns all submission requirements, repo standards, and available API endpoints.

**Input schema:**
```json
{}
```

**Output schema:**
```json
{
  "schema_version": "string",
  "required_files": ["string"],
  "required_fields": ["string"],
  "recommended_files": ["string"],
  "optional_files": ["string"],
  "license_guidance": "string",
  "preferred_licenses": ["string"],
  "allowed_licenses": ["string"],
  "agent_harnesses": ["string"],
  "budget_tiers": ["string"],
  "mcp_tools": ["string"],
  "api_endpoints": {
    "create_submission": "string",
    "update_submission": "string",
    "finalize_submission": "string",
    "submit_repo_analysis": "string",
    "get_status": "string",
    "cast_vote": "string"
  }
}
```

**Example:**
```
GET /api/v1/requirements
```

---

## MCP Server v1

The repository includes a stdio MCP-compatible server wrapper:

```bash
VIBE_BASE_URL=http://localhost:3000 npm run mcp
```

The server delegates to the existing REST API and exposes:

```txt
vibe.list_requirements
vibe.validate_repo
vibe.create_submission
vibe.update_submission
vibe.finalize_submission
vibe.get_submission_status
```

Agent-native flow:

```txt
1. Read repo
2. Build vibe.json
3. Call vibe.list_requirements
4. Call vibe.validate_repo
5. Call vibe.create_submission
6. Call vibe.update_submission
7. Give start_url and preview_url to the human team lead
8. Call vibe.finalize_submission only after explicit human approval
9. Call vibe.get_submission_status
```

The server is intentionally thin in v1. It preserves the REST API as the source of truth while allowing agents to submit without using the website.

Team management:
- Private route: `/submit/:token/team`
- Token API: `PATCH /api/v1/submissions/:id/team`
- Agents may update teammate names, emails, badge numbers, affiliations/institutions, degrees, and student/trainee status only when provided by the human.
- Agents must not invent team member information.
- Prize eligibility is complete only when every listed team member has a badge number.
- Creating local repo files is not sufficient. Agents must PATCH the hosted draft API before reporting that the submission is complete.
- Team updates are replace-style. The submitted `owner` plus `members[]` becomes the complete current roster.
- To keep a teammate, include them unchanged in `members[]`.
- To update a teammate, include them with updated fields.
- To remove a teammate, omit them from `members[]`.
- Do not revert to older registration details unless the human explicitly asks.

```json
{
  "schema_version": "vibe-hackathon-submission-v1",
  "required_files": ["README.md", "AGENTS.md", "LICENSE", ".env.example"],
  "preferred_licenses": ["MIT", "BSD-3-Clause"],
  "agent_harnesses": ["Claude Code", "Codex CLI", "Cursor", "Aider"]
}
```

---

## Tool: `vibe.validate_repo`

Validates a repo payload against Vibe Hackathon requirements and returns a score and list of errors/warnings.

**Input schema:**
```json
{
  "github_url": "string (required)",
  "demo_url": "string (required)",
  "license": "string (required)",
  "agents_md_url": "string (required)",
  "readme_url": "string (optional)",
  "sample_data_description": "string (required)",
  "screenshot_url": "string (optional)",
  "prompt_strategy_url": "string (optional)",
  "setup_instructions": "string (optional)",
  "deploy_instructions": "string (optional)"
}
```

**Output schema:**
```json
{
  "valid": "boolean",
  "errors": ["string"],
  "warnings": ["string"],
  "score": "number (0-100)"
}
```

**Example request:**
```json
{
  "github_url": "https://github.com/myteam/myproject",
  "demo_url": "https://myproject.vercel.app",
  "license": "MIT",
  "agents_md_url": "https://github.com/myteam/myproject/blob/main/AGENTS.md",
  "sample_data_description": "30 fake users with seeded activity logs"
}
```

**Example response:**
```json
{
  "valid": true,
  "errors": [],
  "warnings": ["Screenshot URL is recommended", "Prompt strategy URL is recommended (docs/prompts.md)"],
  "score": 88
}
```

---

## Tool: `vibe.create_submission`

Creates a new draft submission. Returns an `editToken` that must be saved — it is required for all subsequent updates.

**Input schema:**
```json
{
  "teamName": "string (required)",
  "contactEmail": "string (required)"
}
```

**Output schema:**
```json
{
  "id": "string",
  "submission_id": "string",
  "editToken": "string",
  "status": "draft",
  "start_url": "string",
  "edit_url": "string",
  "preview_url": "string",
  "finalize_url": "string"
}
```

**Example request:**
```
POST /api/v1/submissions
Content-Type: application/json

{
  "teamName": "PromptCraft Collective",
  "contactEmail": "team@promptcraft.dev"
}
```

**Example response:**
```json
{
  "id": "sub_abc123xyz",
  "submission_id": "sub_abc123xyz",
  "editToken": "edit_xyz789longtoken",
  "status": "draft",
  "start_url": "https://vibe-hackathon.example.com/submit/edit_xyz789longtoken/start",
  "edit_url": "https://vibe-hackathon.example.com/submit/edit_xyz789longtoken",
  "preview_url": "https://vibe-hackathon.example.com/submit/edit_xyz789longtoken/preview",
  "finalize_url": "https://vibe-hackathon.example.com/api/v1/submissions/sub_abc123xyz/finalize"
}
```

**Notes:**
- Save the `editToken` immediately — it cannot be recovered without GitHub OAuth.
- The submission starts as a `draft` and is not publicly visible.
- Open `start_url` to choose manual or agent-assisted completion, then `preview_url` for human review before finalization.

---

## Tool: `vibe.update_submission`

Updates an existing draft submission. Requires the `editToken` in the Authorization header.

**Input schema:**
```json
{
  "id": "string (required — submission ID)",
  "editToken": "string (required — used as Bearer token)",
  "teamName": "string (optional)",
  "contactEmail": "string (optional)",
  "members": "string (optional — one per line: 'Name — Role')",
  "projectTitle": "string (optional)",
  "problemStatement": "string (optional)",
  "targetUsers": "string (optional)",
  "demoUrl": "string (optional)",
  "githubUrl": "string (optional)",
  "screenshotUrl": "string (optional)",
  "readmeUrl": "string (optional)",
  "agentsMdUrl": "string (optional)",
  "promptStrategyUrl": "string (optional)",
  "sampleDataDescription": "string (optional)",
  "setupInstructions": "string (optional)",
  "deployInstructions": "string (optional)",
  "knownLimitations": "string (optional)",
  "aiToolsUsed": ["string"] ,
  "tags": ["string"],
  "license": "string (optional)",
  "agentHarnesses": ["string"],
  "agentModels": ["string"],
  "budgetTier": "string (optional)",
  "estimatedHumanHours": "number (optional)",
  "estimatedAgentHours": "number (optional)"
}
```

**Output schema:**
```json
{
  "success": true,
  "submission_id": "string",
  "status": "draft | submitted | finalized | locked",
  "start_url": "string",
  "edit_url": "string",
  "preview_url": "string",
  "finalize_url": "string"
}
```

**Example request:**
```
PATCH /api/v1/submissions/sub_abc123xyz
Authorization: Bearer edit_xyz789longtoken
Content-Type: application/json

{
  "projectTitle": "Agentix — AI Code Review Agent",
  "demoUrl": "https://agentix-demo.vercel.app",
  "githubUrl": "https://github.com/promptcraft/agentix",
  "license": "MIT"
}
```

---

## Tool: `vibe.finalize_submission`

Marks a submission as submitted. After finalization, the submission is locked for editing.

**Input schema:**
```json
{
  "id": "string (required — submission ID)",
  "editToken": "string (required — used as Bearer token)"
}
```

**Output schema:**
```json
{
  "success": true,
  "status": "submitted"
}
```

**Example request:**
```
POST /api/v1/submissions/sub_abc123xyz/finalize
Authorization: Bearer edit_xyz789longtoken
Content-Type: application/json
{}
```

**Notes:**
- Cannot be undone without admin intervention.
- Submission becomes visible to judges after finalization.
- Agents should not call this tool unless the human team lead explicitly asks them to finalize.

---

## Tool: `vibe.get_submission_status`

Returns the current status and metadata for a submission. Public endpoint — no auth required.

**Input schema:**
```json
{
  "id": "string (required — submission ID)"
}
```

**Output schema:**
```json
{
  "id": "string",
  "status": "draft | submitted | finalized | locked",
  "projectTitle": "string | null",
  "teamName": "string",
  "createdAt": "string (ISO date)",
  "submittedAt": "string | null",
  "totalVotes": "number"
}
```

**Example request:**
```
GET /api/v1/submissions/sub_abc123xyz/status
```

**Example response:**
```json
{
  "id": "sub_abc123xyz",
  "status": "submitted",
  "projectTitle": "Agentix — AI Code Review Agent",
  "teamName": "PromptCraft Collective",
  "createdAt": "2025-11-10T09:00:00.000Z",
  "submittedAt": "2025-11-14T22:30:00.000Z",
  "totalVotes": 47
}
```

---

## Tool: `vibe.submit_agent_report`

Submits a repo analysis report for a submission. Updates extended fields like license, agent harnesses, budget tier, and vibe.json payload. Requires editToken.

**Input schema:**
```json
{
  "id": "string (required — submission ID)",
  "editToken": "string (required — used as Bearer token)",
  "license": "string (optional)",
  "agentHarnesses": ["string"],
  "agentModels": ["string"],
  "budgetTier": "string (optional — see budget_tiers in requirements)",
  "estimatedHumanHours": "number (optional)",
  "estimatedAgentHours": "number (optional)",
  "vibeJsonRaw": "string | object (optional — raw vibe.json content)"
}
```

**Output schema:**
```json
{
  "success": true,
  "validation": {
    "valid": "boolean",
    "errors": ["string"],
    "warnings": ["string"],
    "score": "number"
  }
}
```

**Example request:**
```
POST /api/v1/submissions/sub_abc123xyz/repo-analysis
Authorization: Bearer edit_xyz789longtoken
Content-Type: application/json

{
  "license": "MIT",
  "agentHarnesses": ["Claude Code", "Cursor"],
  "agentModels": ["claude-opus-4-5", "claude-sonnet-4-5"],
  "budgetTier": "api_10_to_50",
  "estimatedHumanHours": 12,
  "estimatedAgentHours": 48
}
```

**Example response:**
```json
{
  "success": true,
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": ["Screenshot URL is recommended"],
    "score": 92
  }
}
```

---

## Agent Submission Flow

A complete agent submission flow looks like:

```
1. GET  /api/v1/requirements           → read all requirements
2. POST /api/v1/submissions            → create draft, save editToken
3. PATCH /api/v1/submissions/:id       → fill in all fields
4. POST /api/v1/submissions/:id/repo-analysis  → submit repo analysis
5. Open preview_url                    → human reviews the draft
6. GET  /api/v1/submissions/:id/status → verify status
7. POST /api/v1/submissions/:id/finalize  → lock and submit only after explicit human approval
```

## Team Registration Boundary

Team registration is human-owned.

Agents should not register teams unless explicitly instructed. A human team owner should register first at `/register-team` using Better Auth GitHub OAuth. After registration, the platform returns `edit_url`, `preview_url`, and `finalize_url`; MCP tools may then update the draft using the edit token.

MCP create responses include `team_id` for consistency, but MCP-created drafts are not GitHub-owned unless a human owner registers or ownership is attached separately in a future workflow.

Ownership mode:
- `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=true`: GitHub ownership required for `/register-team` and `/recover`.
- `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=false`: badge ownership mode; no OAuth app required. Agents still should not register teams unless explicitly instructed.

## Budget Tier Values

| Tier | Description |
|------|-------------|
| `free_trial_only` | Only free tier / trial credits used |
| `standard_subscription` | One paid subscription (e.g. Claude Pro, Cursor Pro) |
| `multiple_paid_subscriptions` | Multiple paid subscriptions |
| `api_under_10` | API spend under $10 |
| `api_10_to_50` | API spend $10–$50 |
| `api_50_to_200` | API spend $50–$200 |
| `api_over_200` | API spend over $200 |
| `local_models_only` | Only local/self-hosted models used |
| `unknown` | Not tracked |
