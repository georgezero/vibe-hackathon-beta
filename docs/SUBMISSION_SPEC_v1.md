# Vibe Hackathon — Submission Specification v1

**Schema version**: `vibe-hackathon-submission-v1`  
**Protocol version**: v1.1  
**Status**: Stable  
**Last updated**: 2026-05-31

---

## Overview

This document defines the complete contract for submitting a project to the Vibe Hackathon. It covers:

- The `vibe.json` manifest format
- Required and recommended repository files
- Validation scoring
- REST API endpoints for programmatic submission
- Error response format

Agents should read `/api/v1/requirements` at runtime for the machine-readable version of this spec.

---

## `vibe.json` Schema

Place `vibe.json` at the root of your repository. It is the canonical source of truth for your submission.

```json
{
  "schema": "vibe-hackathon-submission-v1",

  "team": {
    "name": "Your Team Name",
    "contact_email": "you@example.com",
    "members": [
      { "name": "Alice", "role": "Full-stack + AI" },
      { "name": "Bob", "role": "Design" }
    ],
    "github_org": "your-github-org"
  },

  "project": {
    "name": "Project Title",
    "summary": "One paragraph describing the problem and solution.",
    "demo_url": "https://your-demo.vercel.app",
    "github_url": "https://github.com/org/repo",
    "demo_video_url": "https://www.youtube.com/watch?v=...",
    "screenshot_urls": ["https://your-demo.vercel.app/screenshot.png", "https://..."],
    "screenshot_url": "https://your-demo.vercel.app/screenshot.png",
    "target_users": ["engineers", "researchers"],
    "tags": ["developer tools", "AI", "automation"]
  },

  "repo": {
    "license": "MIT",
    "agents_md_url": "https://github.com/org/repo/blob/main/AGENTS.md",
    "readme_url": "https://github.com/org/repo/blob/main/README.md",
    "env_example": "https://github.com/org/repo/blob/main/.env.example",
    "install": "npm install",
    "run": "npm run dev",
    "test": "npm test",
    "sample_data": "20 fake patient records seeded via `npm run db:seed`. No real PII used."
  },

  "agentic_dev": {
    "harnesses": ["Claude Code", "Cursor"],
    "models": ["claude-opus-4-5", "claude-sonnet-4-5"],
    "local_models": [],
    "budget_tier": "api_10_to_50",
    "estimated_human_hours": 12,
    "estimated_agent_hours": 40,

    "estimated_tokens": 4200000,
    "token_estimate_method": "provider_dashboard",
    "metadata_confidence": "medium",
    "analytics_notes": "Token count from Anthropic console. Does not include local Cursor usage.",

    "prompt_notes_url": "https://github.com/org/repo/blob/main/docs/prompts.md",
    "agent_report_url": "https://github.com/org/repo/blob/main/docs/agent-report.md",
    "known_limitations": "Only supports English. Demo may be slow on cold start."
  }
}
```

---

## Required Fields

| Field | Description |
|-------|-------------|
| `schema` | Must be `"vibe-hackathon-submission-v1"` |
| `team.name` | Team or solo developer name |
| `team.contact_email` | Primary contact (not published publicly) |
| `project.name` | Project title |
| `project.summary` | 1–3 sentence description of the problem and solution |
| `project.demo_url` | Live demo URL — must be reachable by judges |
| `project.github_url` | Public GitHub repository URL |
| `repo.license` | SPDX license identifier |
| `repo.agents_md_url` | URL to your `AGENTS.md` file on GitHub |
| `repo.install` | Command to install dependencies |
| `repo.run` | Command to start the app locally |
| `agentic_dev.harnesses` | Array — tools used to write code (see below) |
| `agentic_dev.models` | Array — AI models used in development |
| `agentic_dev.budget_tier` | Estimated API spend tier (see below) |

---

## Submission Artifacts

### Required (compliance failures if missing)

| File | Purpose |
|------|---------|
| `vibe.json` | Machine-readable manifest — the canonical submission record |
| `README.md` | Public project overview, install, and usage |
| `AGENTS.md` | Instructions for coding agents to run/deploy this repo |
| `LICENSE` | Open-source license (MIT or BSD-3-Clause preferred) |
| `.env.example` | Env var template — **no real secrets** |

### Recommended (bonus scoring if present)

| File | Purpose |
|------|---------|
| `docs/vibe-submission.md` | Narrative submission form — human/agent readable |
| `docs/agent-report.md` | Detailed agent workflow evidence for judges |
| `docs/prompts.md` | Key prompts used during development |

### Optional

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Adds reproducibility and deployment points |
| `docs/architecture.md` | Architecture overview |

### Never commit to GitHub

- Edit tokens (`edit_*`)
- Real `.env` values or API keys
- Any credential or secret of any kind

Screenshots and demos are URLs only — no file uploads.

---

## Optional Agent Report

`docs/agent-report.md` is optional in v1 but recommended. It should summarize how agents contributed to the project.

Suggested sections:

| Section | Purpose |
|---------|---------|
| Architecture decisions | Major design decisions and why they were made |
| Major prompts | Important prompts or prompt patterns used |
| Feature cuts | Scope that was intentionally removed |
| Failed approaches | Attempts that did not work |
| Debugging strategy | How agents helped diagnose and fix issues |
| Agent roles | Which agents/harnesses handled which parts of the build |

---

## Allowed Licenses

**Preferred** (no score penalty): `MIT`, `BSD-3-Clause`, `BSD-2-Clause`

**Allowed** (minor warning): `Apache-2.0`, `GPL-3.0`, `LGPL-2.1`, `AGPL-3.0`, `MPL-2.0`

**Not accepted**: Proprietary licenses, no license, or "all rights reserved"

---

## Agent Harnesses

Use the exact strings from this list in `agentic_dev.harnesses`:

- `Claude Code`
- `Codex CLI`
- `Cursor`
- `Aider`
- `Devin`
- `SWE-agent`
- `GitHub Copilot`
- `Windsurf`
- `Other`

---

## Budget Tiers

Use one of these exact strings in `agentic_dev.budget_tier`:

| Tier | Description |
|------|-------------|
| `free_trial_only` | Used only free trial credits |
| `standard_subscription` | One paid subscription (Cursor, Claude.ai Pro, etc.) |
| `multiple_paid_subscriptions` | Multiple paid subscriptions |
| `api_under_10` | API spend under $10 |
| `api_10_to_50` | API spend $10–$50 |
| `api_50_to_200` | API spend $50–$200 |
| `api_over_200` | API spend over $200 |
| `local_models_only` | Only used local/self-hosted models |
| `unknown` | Cannot estimate |

---

## Self-Reported Analytics Fields

These optional fields in `agentic_dev` capture token/cost data for event analytics. They are displayed with a **Self-reported** badge in the admin dashboard and submission detail — the platform does not verify these values.

| Field | Type | Values |
|-------|------|--------|
| `estimated_tokens` | number | Total tokens consumed across the project |
| `token_estimate_method` | string | `exact`, `exported_logs`, `provider_dashboard`, `rough_estimate`, `unknown` |
| `metadata_confidence` | string | `low`, `medium`, `high` |
| `analytics_notes` | string | Free-form explanation of how estimates were derived |

---

## Source Tracking

Every create and update records the client source in the audit log:

| Source | When |
|--------|------|
| `web` | Submitted via the web form at `/submit/:token` |
| `api` | Submitted via REST API directly |
| `mcp` | Submitted via the MCP server tools |

Pass `"source": "mcp"` (or `"api"`) in the PATCH body to identify the calling client. Source is never exposed publicly.

---

## Deadline Behavior

| Operation | Before deadline | After deadline |
|-----------|----------------|----------------|
| Create submission | ✓ | 403 `DEADLINE_PASSED` |
| Update (draft) | ✓ | 403 `DEADLINE_PASSED` |
| Update (finalized) | ✓ | 403 `DEADLINE_PASSED` |
| Finalize | ✓ | 403 `DEADLINE_PASSED` |
| View projects | ✓ | ✓ |

A 403 with `DEADLINE_PASSED` error code means the event submission window has closed.

---

## Validation Scoring

Submissions are scored 0–100. Scores below 60 trigger a compliance warning. Scores below 40 may be rejected.

| Check | Points |
|-------|--------|
| GitHub URL present | 20 |
| Demo URL present | 20 |
| AGENTS.md URL present | 15 |
| License present and valid | 10 |
| Sample data description | 10 |
| Install command | 5 |
| Run command | 5 |
| Agent harnesses specified | 5 |
| Agent models specified | 5 |
| Budget tier valid | 3 |
| README URL | 3 |
| Screenshot URL | 3 |
| Prompt strategy URL | 2 |

---

## REST API

### Machine-readable requirements

```
GET /api/v1/requirements
```

Returns this spec in JSON format, including the full field list, valid values, and endpoint map.

---

### Create a submission

```
POST /api/v1/submissions
Content-Type: application/json

{
  "teamName": "Your Team",
  "contactEmail": "you@example.com"
}
```

Response `201`:
```json
{
  "id": "sub_abc12345",
  "editToken": "edit_xxxxxxxxxxxxxxxx",
  "status": "draft"
}
```

Save `editToken` — it's the only way to update or finalize your submission.

---

### Create submission from vibe.json (one-shot)

```
POST /api/v1/submissions/from-repo
Content-Type: application/json

{
  "vibe_json": { ...vibe.json object... }
}
```

This is the preferred agent workflow. Provide your complete `vibe.json` and a submission is created in one call.

Response `201`:
```json
{
  "id": "sub_abc12345",
  "editToken": "edit_xxxxxxxxxxxxxxxx",
  "editUrl": "https://vibe-hackathon.example.com/submit/edit_xxxxxxxxxxxxxxxx",
  "status": "draft",
  "validationResult": {
    "valid": true,
    "errors": [],
    "warnings": ["Screenshot URL is recommended"],
    "score": 95
  }
}
```

---

### Update a submission

```
PATCH /api/v1/submissions/:id
Authorization: Bearer <editToken>
Content-Type: application/json

{
  "projectTitle": "Updated Title",
  "demoUrl": "https://new-demo.vercel.app",
  "source": "api"
}
```

Accepts any subset of submission fields plus an optional `source` field (`"web"`, `"api"`, `"mcp"`) for audit tracking.

Draft and finalized submissions can both be updated before the deadline. After the deadline returns 403 with `DEADLINE_PASSED`.

Returns `{ "success": true }`.

---

### Finalize a submission

```
POST /api/v1/submissions/:id/finalize
Authorization: Bearer <editToken>
```

Marks the submission as ready for judging and triggers the deterministic AI review. You can still update and re-finalize before the deadline. After the deadline, no further changes are accepted.

Response `200`:
```json
{
  "success": true,
  "status": "submitted",
  "validationResult": {
    "valid": true,
    "errors": [],
    "warnings": [],
    "score": 98
  }
}
```

---

### Submit agent repo analysis

```
POST /api/v1/submissions/:id/repo-analysis
Authorization: Bearer <editToken>
Content-Type: application/json

{
  "repoUrl": "https://github.com/org/repo",
  "filesFound": ["README.md", "AGENTS.md", "LICENSE", ".env.example"],
  "filesMissing": [],
  "agentNotes": "All required files present. AGENTS.md has 12 sections.",
  "detectedLicense": "MIT",
  "detectedStack": ["Next.js", "SQLite", "TypeScript"]
}
```

---

### Check submission status (public)

```
GET /api/v1/submissions/:id/status
```

Returns current status without requiring auth.

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — missing required fields or invalid values |
| `401` | Authorization required — missing or malformed Bearer token |
| `403` | Forbidden — wrong token, submission locked, or deadline passed (`code: "DEADLINE_PASSED"`) |
| `404` | Submission not found |
| `500` | Internal server error |

---

## Agent Workflow (Recommended)

```bash
# 1. Fetch requirements
curl https://vibe-hackathon.example.com/api/v1/requirements

# 2. Create submission from vibe.json
curl -X POST https://vibe-hackathon.example.com/api/v1/submissions/from-repo \
  -H "Content-Type: application/json" \
  -d '{"vibe_json": '"$(cat vibe.json)"'}'

# 3. Save the returned editToken, then update if needed
curl -X PATCH https://vibe-hackathon.example.com/api/v1/submissions/sub_xxx \
  -H "Authorization: Bearer edit_xxx" \
  -H "Content-Type: application/json" \
  -d '{"screenshotUrl": "https://...", "screenshotUrls": ["https://...", "https://..."]}'

# 4. Human opens start_url or preview_url returned by create/update

# 5. Finalize only after explicit human approval
curl -X POST https://vibe-hackathon.example.com/api/v1/submissions/sub_xxx/finalize \
  -H "Authorization: Bearer edit_xxx"
```

Create and update responses include `start_url`, `edit_url`, `preview_url`, and `finalize_url`. `start_url` points to `/submit/:token/start`, where teams choose manual completion or agent-assisted completion. `preview_url` points to `/submit/:token/preview`, a private draft review page with public-card preview, project-detail preview, readiness checks, and a copyable agent revision prompt.

Agents should update drafts and provide `preview_url` to the human team lead. They should not finalize unless explicitly instructed by that human.

---

## Team Registration v1

Teams should register before completing the submission artifact workflow.

Human-owned registration:
- Route: `/register-team`
- Collects team name, owner contact email, and owner badge number
- Requires one GitHub-authenticated team owner when `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=true`
- Auth layer: Better Auth with GitHub provider only
- Teammates do not need accounts
- Max team size: 6 including owner
- Owner badge number is required
- Teammate rows require name if present
- Teammate badge number is recommended for prize eligibility but does not block registration

After registration, the system creates:
- team
- team owner metadata
- team members
- draft submission
- edit token

The owner is redirected to `/submit/:token/start`.

API/MCP create responses include:

```json
{
  "submission_id": "sub_xxx",
  "team_id": "team_xxx",
  "status": "draft",
  "start_url": "https://example.com/submit/edit_xxx/start",
  "edit_url": "https://example.com/submit/edit_xxx",
  "preview_url": "https://example.com/submit/edit_xxx/preview",
  "finalize_url": "https://example.com/api/v1/submissions/sub_xxx/finalize"
}
```

Agents should not register teams unless explicitly instructed. A human team owner should register via GitHub first, then pass the edit and preview URLs to the agent.

Badge numbers are for organizer eligibility verification only. They must not be included in public pages, public APIs, AI eval bundles, or AI eval prompts.

### Team management and prize eligibility

Private route: `/submit/:token/team`

This route uses the same edit token as the manual submission form and preview.

Editable owner fields:
- name
- email
- badge number
- affiliation / institution
- degree(s)
- student / trainee status
- ownership type display: GitHub owner or Badge owner

Editable teammate fields:
- name
- email
- badge number
- affiliation / institution
- degree(s)
- student / trainee status

Rules:
- Owner cannot be removed.
- Max team size is 6 including owner.
- Owner name, email, and badge number are required.
- Teammate name is required when a teammate row exists.
- Teammate badge number is recommended but does not block saving.
- Prize eligibility is `Eligible` only when every team member has a badge number.
- Student/trainee status is counted but does not affect prize eligibility yet.
- Team updates are replace-style: the submitted `owner` plus `members[]` becomes the complete current roster.
- To keep a teammate, include them unchanged in `members[]`.
- To update a teammate, include them with updated fields.
- To remove a teammate, omit them from `members[]`.
- Do not revert to older registration details unless the human explicitly asks.

Token-authenticated API:

```http
PATCH /api/v1/submissions/:id/team
Authorization: Bearer edit_xxx
Content-Type: application/json
```

```json
{
  "owner": {
    "name": "Owner Name",
    "email": "owner@example.com",
    "badgeNumber": "BADGE-123",
    "affiliation": "Institution",
    "degrees": "MD",
    "isStudentTrainee": false
  },
  "members": []
}
```

Example replace-style roster update:

Current roster:
- Owner: Elena Park
- Marcus Hill
- Priya Shah
- Daniel Kim

Intended roster:
- Owner: Elena Park
- Marcus Hill
- Priya Shah

Send `members[]` containing Marcus and Priya only. Daniel will be removed.

Ownership mode:
- `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=true`: GitHub owner required.
- `VIBE_HACKATHON_REQUIRE_GITHUB_AUTH=false`: badge owner mode. Registration does not require OAuth; contact email + owner badge number are used for recovery.

---

## Versioning

This spec is `v1`. Breaking changes will increment the version. The `schema` field in `vibe.json` pins a submission to a spec version. The platform accepts all supported schema versions; judges and AI reviewers use the schema version to interpret the submission.
